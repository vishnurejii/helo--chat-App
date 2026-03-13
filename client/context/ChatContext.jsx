import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {

    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [unseenMessages, setUnseenMessages] = useState({});

    const [callState, setCallState] = useState({
        active: false,
        incoming: false,
        type: null, // "video" or "voice"
        fromUser: null,
        targetUserId: null,
        offer: null,
        localStream: null,
        remoteStream: null,
    });

    const peerRef = useRef(null);
    const { socket, axios } = useContext(AuthContext);

//function to get all users for sidebar
const getUsers = async () => {
    try {
        const { data } = await axios.get("/api/messages/users");

        if (data.success) {
            setUsers(data.users);
            setUnseenMessages(data.unseenMessages);
        }

    } catch (error) {
        toast.error(error.message);
    }
};

//function to get messages for selected user
const getMessages = async (userId) => {
    try {

        const { data } = await axios.get(`/api/messages/${userId}`);

        if (data.success) {
            setMessages(data.messages);
        }

    } catch (error) {
        toast.error(error.message);
    }
};

//function to send message to selected user
const sendMessage = async (messageData) => {

    try {

        if (!selectedUser) return;

        const { data } = await axios.post(
            `/api/messages/send/${selectedUser._id}`,
            messageData
        );

        if (data.success) {
            setMessages((prevMessages) => [...prevMessages, data.newMessage]);
        } else {
            toast.error(data.message);
        }

    } catch (error) {
        toast.error(error.message);
    }
};

//function to subscribe to messages for selected user
const subscribeToMessages = () => {

    if (!socket) return;

    socket.on("newMessage", (newMessage) => {

        if (selectedUser && newMessage.senderId === selectedUser._id) {

            newMessage.seen = true;

            setMessages((prevMessages) => [...prevMessages, newMessage]);

            axios.put(`/api/messages/mark/${newMessage._id}`);

        } else {

            setUnseenMessages((prevUnseenMessages) => ({
                ...prevUnseenMessages,
                [newMessage.senderId]: prevUnseenMessages[newMessage.senderId]
                    ? prevUnseenMessages[newMessage.senderId] + 1
                    : 1
            }));

        }

    });
};

const getUserById = (id) => users.find((u) => u._id === id);

const clearCall = () => {
    peerRef.current?.close();
    peerRef.current = null;
    if (callState.localStream) {
        callState.localStream.getTracks().forEach((track) => track.stop());
    }
    if (callState.remoteStream) {
        callState.remoteStream.getTracks().forEach((track) => track.stop());
    }
    setCallState({
        active: false,
        incoming: false,
        type: null,
        fromUser: null,
        targetUserId: null,
        localStream: null,
        remoteStream: null,
    });
};

const initPeerConnection = (peerUserId) => {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
            socket.emit("ice-candidate", {
                to: peerUserId,
                candidate: event.candidate,
            });
        }
    };

    pc.ontrack = (event) => {
        setCallState((prev) => ({
            ...prev,
            remoteStream: event.streams[0],
        }));
    };

    return pc;
};

const startCall = async (callType) => {
    if (!selectedUser || !socket) return;

    try {
        const mediaConstraints = { audio: true, video: callType === "video" };
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

        const pc = initPeerConnection(selectedUser._id);
        peerRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        setCallState({
            active: true,
            incoming: false,
            type: callType,
            fromUser: null,
            targetUserId: selectedUser._id,
            localStream: stream,
            remoteStream: null,
        });

        socket.emit("call-user", {
            to: selectedUser._id,
            offer,
            callType,
        });
    } catch (error) {
        toast.error(error.message || "Failed to start call");
        clearCall();
    }
};

const acceptCall = async () => {
    const { fromUser, type } = callState;
    if (!fromUser || !socket) return;

    try {
        const mediaConstraints = { audio: true, video: type === "video" };
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

        const pc = initPeerConnection(fromUser._id);
        peerRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        await pc.setRemoteDescription(callState.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        setCallState((prev) => ({
            ...prev,
            active: true,
            incoming: false,
            localStream: stream,
        }));

        socket.emit("answer-call", {
            to: fromUser._id,
            answer,
        });
    } catch (error) {
        toast.error(error.message || "Failed to answer call");
        endCall();
    }
};

const endCall = () => {
    if (socket && callState.targetUserId) {
        socket.emit("end-call", { to: callState.targetUserId });
    }
    clearCall();
};

// socket signaling listeners
useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = ({ from, offer, callType }) => {
        const fromUser = getUserById(from);
        setCallState({
            active: false,
            incoming: true,
            type: callType,
            fromUser: fromUser || { _id: from, fullName: "Unknown" },
            targetUserId: from,
            offer,
            localStream: null,
            remoteStream: null,
        });
    };

    const handleCallAnswered = async ({ answer }) => {
        if (!peerRef.current) return;
        await peerRef.current.setRemoteDescription(answer);
    };

    const handleIceCandidate = async ({ candidate }) => {
        if (!peerRef.current) return;
        try {
            await peerRef.current.addIceCandidate(candidate);
        } catch (e) {
            console.error("Failed to add ICE Candidate", e);
        }
    };

    const handleCallEnded = () => {
        clearCall();
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-answered", handleCallAnswered);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-ended", handleCallEnded);

    return () => {
        socket.off("incoming-call", handleIncomingCall);
        socket.off("call-answered", handleCallAnswered);
        socket.off("ice-candidate", handleIceCandidate);
        socket.off("call-ended", handleCallEnded);
    };
}, [socket, users, callState.offer]);

//function to unsubscribe from messages
const unsubscribeFromMessages = () => {
    if (socket) socket.off("newMessage");
};

useEffect(() => {

    subscribeToMessages();

    return () => unsubscribeFromMessages();

}, [socket, selectedUser]);

const value = {
    messages,
    users,
    selectedUser,
    getUsers,
    getMessages,
    sendMessage,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    callState,
    startCall,
    acceptCall,
    endCall,
};

return (
    <ChatContext.Provider value={value}>
        {children}
    </ChatContext.Provider>
);

};
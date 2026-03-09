import express from "express"
import { protectRoutes } from "../middleware/auth"
import { getMessages, getUsersForSidebar, markMessageAsSeen } from "../controllers/messageController"

const messageRouter=express.Router()

messageRouter.get("/users",protectRoutes,getUsersForSidebar)

messageRouter.get("/:id",protectRoutes,getMessages)
messageRouter.put("mark/:id",protectRoutes,markMessageAsSeen)

export default messageRouter
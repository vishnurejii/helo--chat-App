import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import ChatContainer from '../components/ChatContainer'
import RightSideBar from '../components/RightSideBar'

const HomePage = () => {

    const[selectesUser,setSelectedUser]=useState(false)

  return (
    <div className='border w-full h-screen sm:px-[15%] sm:py-[5%] '>
       <div className={`backdrop-blur-xl border-2 border-gray-600 rounded-2xl
        overflow-hidden h-[100%] grid grid-cols-1 relative ${selectesUser ? 'md:grid-cols-[1fr_1.5fr_1fr] xl:grid-cols-[1fr_2fr_1fr]' : 'md:grid-cols-2'}`}>
            <Sidebar />
            <ChatContainer  />
            <RightSideBar selectedUser={selectesUser} setSelectedUSer={setSelectedUser} />

        </div>
    </div>
  )
}

export default HomePage
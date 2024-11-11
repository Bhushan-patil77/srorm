import React, { useEffect, useState } from 'react'
import { io } from 'socket.io-client';
import ting from '../assets/pop.mp3'
const socket = io('https://srorm-3.onrender.com');


function Home() {
  const backendUrl = import.meta.env.VITE_backend_URL;
  const loggedInUser = JSON.parse(localStorage.getItem('user'))
  const clickedUser = localStorage.getItem('clickedUser')
  const [recentChats, setRecentChats] = useState([])
  const [globalMsgObject, setGlobalMsgObject] = useState([])
  const [typing, setTyping] = useState(false)


const [unreadMsgObj, setUnreadMsgObj] = useState({})

const [clickedRecentChat, setClickedRecentChat]=useState({})


  const [clickedUserInfo, setClickedUserInfo] = useState({})
  const [searchedUsers, setSearchedUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [previousMessages, setPreviousMessages] = useState([]);
  const [senderSocketId, setSenderSocketId] = useState(null);
  const [recipient, setRecipient] = useState({})
  const [isSomeoneTyping, setIsSomeoneTyping] = useState(false)
  const audio = new Audio(ting)

useEffect(()=>{
  console.log(backendUrl)
},[globalMsgObject])

  useEffect(() => {  //updating socket id in db when page refresh or connected

    const promise = new Promise((resolve, reject) => {
      if (socket.connected) {
        resolve(socket.id)
      } else {
        socket.on('connect', () => {
          resolve(socket.id)
        })
      }
    })

    promise.then((res) => { socket.emit('updateSocketId', { _id: loggedInUser._id, socketId: socket.id }); updateSocketIdInLocalstorage(res) })

    socket.emit('iAmCommingOnline', loggedInUser._id)

    localStorage.setItem('clickedUser', '')

  }, [])


  useEffect(() => {
    getHistory(loggedInUser._id)
  }, [])

  useEffect(() => {
    socket.on('someoneCameOnline', ({ _id, socketId }) => {

      setGlobalMsgObject((prevGlobalMsgObject)=>{
        const updatedGlobalObj = prevGlobalMsgObject.map((obj)=>{
          if(obj.user._id===_id)
          {
            return {...obj, user:{...obj.user, socketId: socketId, status:'online'}}
          }
          else
          {
            return obj
          }
        })

        return updatedGlobalObj
      })

      

      setClickedUserInfo((prevClickedUserInfo)=>{
        return {...prevClickedUserInfo, status:'online'}
      })


      if (localStorage.getItem('clickedUser') === _id) {

        setRecipient((prevRecipient) => {
          return { ...prevRecipient, socketId: socketId }
        })

      }


    })

    socket.on('someoneGoingOffline', ({ socketId }) => {

      setGlobalMsgObject((prevGlobalMsgObject)=>{
        const updatedGlobalObj = prevGlobalMsgObject.map((obj)=>{
          if(obj.user.socketId==socketId)
          {
            return {...obj, user:{...obj.user, status:'offline', lastSeen:new Date()}}
          }
          else
          {
            return obj
          }
        })

        return updatedGlobalObj
      })

    setClickedUserInfo((prevClickedUserInfo)=>{
        return {...prevClickedUserInfo, status:'offline', lastSeen:new Date()}
      })



    })



    let typingTimer;
    const typingStatusMap = new Map(); // Map to track if a user is already marked as typing

    socket.on('someoneIsTyping', (_id) => {

      // Only update recentChats if the user's status is not already "typing..."
      if (!typingStatusMap.get(_id)) {
        // setRecentChats((prevChats) => prevChats.map((chat) => chat._id === _id ? { ...chat, status: 'typing...' } : chat ) );
        setGlobalMsgObject((prevGlobalMsgObject) => {
          return prevGlobalMsgObject.map((obj) => {
            if (obj.user._id === _id) {
              // Return the updated object with the modified status
              return {
                ...obj,  // Spread the existing object
                user: {
                  ...obj.user,
                  status: 'typing...',  // Update the status
                }
              };
            } else {
              return obj;  // Return the object unchanged if the IDs don't match
            }
          });
        });


      


            setClickedUserInfo((prevClickedUserInfo)=>{
              if(prevClickedUserInfo._id===_id)
              {
                return {...prevClickedUserInfo, status:'typing...'}
              }
              else
              {
                return prevClickedUserInfo
              }
            })
      

        typingStatusMap.set(_id, true); // Set the flag to true, marking user as typing
      }

      // Clear any existing timer to avoid resetting to "online" too soon
      clearTimeout(typingTimer);

      // Set a timeout to reset the status to "online" after typing stops
      typingTimer = setTimeout(() => {
        // setRecentChats((prevChats) => prevChats.map((chat) => chat._id === _id ? { ...chat, status: 'online' } : chat ));

        setGlobalMsgObject((prevGlobalMsgObject) => {
          return prevGlobalMsgObject.map((obj) => {
            if (obj.user._id === _id) {
              // Return the updated object with the modified status
              return {
                ...obj,  // Spread the existing object
                user: {
                  ...obj.user,
                  status: 'online',  // Update the status
                }
              };
            } else {
              return obj;  // Return the object unchanged if the IDs don't match
            }
          });
        });

        setClickedUserInfo((prevClickedUserInfo)=>{
          if(prevClickedUserInfo._id===_id)
          {
            return {...prevClickedUserInfo, status:'online'}
          }
          else
          {
            return prevClickedUserInfo
          }
        })

        typingStatusMap.set(_id, false); // Reset the flag to false after setting to online
      }, 1000); // 1-second delay before resetting to "online"
    });









  }, [])


  useEffect(() => { 

    setUnreadMsgObj(prevState => {
      const { [recipient._id]:removed, ...remainingState } = prevState;
      return remainingState;  
    });

  }, [recipient])


  useEffect(() => {   // when msg rcved

    socket.on('receiveMessage', (msgObj) => {

      console.log(msgObj)

      let flag = false;

      setGlobalMsgObject((prevGlobalMsgObject) => {
        // Separate the updated object and put it at the top
        const updatedObject = prevGlobalMsgObject.find(obj => obj.user._id === msgObj.sender._id);
        
        if (updatedObject) {
          // Update the messages for the matched object
          const newObject = {
            ...updatedObject,
            messages: [...updatedObject.messages, msgObj]
          };
      
          // Return a new array with the updated object at the top, removing duplicates
          return [
            newObject,
            ...prevGlobalMsgObject.filter(obj => obj.user._id !== msgObj.sender._id)
          ];
        } else {
          // If no match is found, just append the new object to the top
          return [{ user: msgObj.sender, messages: [msgObj] }, ...prevGlobalMsgObject];
        }
      });
      
      


      if (msgObj.sender._id === localStorage.getItem('clickedUser')) {
        setPreviousMessages((prevMessages) => [...prevMessages, msgObj]);
      } else {
        flag=true
        setUnreadMsgObj(prevState => {
          // Check if the user exists, if not, initialize them with count 0 and content ''
          const user = prevState[msgObj.sender._id] || { count: 0, lastMsg: '' };
      
          // Increment the count and update the content
          const newCount = user.count + 1;
          const newContent = msgObj.content;
      
          return {
            ...prevState,  // Retain other users' data
            [msgObj.sender._id]: { count: newCount, lastMsg: newContent }, // Update the specific user's data
          };
        });
      }


      fetch(`${backendUrl}/updateRecentChats`, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: loggedInUser._id, chat: msgObj.sender, senderId: msgObj.sender._id, content:msgObj.content, flag:flag }) })
        .then((response) => { return response.json() })
        .then((data) => { console.log(data) })
        .catch((err) => { alert(err) })

    });

    return () => {
      socket.off('receiveMessage');
    };
  }, []);


  const sendMessage = () => {
    if (message && recipient._id) {

      const msgObj = {
        sender: loggedInUser,
        receiver: recipient,
        content: message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      setPreviousMessages((prevMessages) => [...prevMessages, msgObj]);

    
      setGlobalMsgObject((prevGlobalMsgObject) => {
        // Check if the sender already exists in the array
        const existingReceiver = prevGlobalMsgObject.find(obj => obj.user._id === msgObj.receiver._id);
      
        if (existingReceiver) {
          // If sender exists, update the messages for that sender
          const updatedReveiver = {
            ...existingReceiver,
            messages: [...existingReceiver.messages, msgObj] // Add the new message
          };
      
          // Return the updated array with the sender moved to the front
          return [
            updatedReveiver,
            ...prevGlobalMsgObject.filter(obj => obj.user._id !== msgObj.receiver._id) // Remove the old sender object
          ];
        } else {
          // If sender does not exist, create a new sender object with the message
          return [
            {
              user: msgObj.receiver,
              messages: [msgObj] // Add the new message as the first message
            },
            ...prevGlobalMsgObject // Keep the rest of the array as is
          ];
        }
      });
      
      


      const chat = {
        _id: recipient._id,
        username: recipient.username,
        email: recipient.email,
        password: recipient.password,
        socketId: recipient.socketId,
        status: recipient.status
      }

      fetch(`${backendUrl}/updateRecentChats`, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: loggedInUser._id, chat: chat }) })
        .then((response) => { return response.json() })
        .then((data) => {
          console.log(data)
        })
        .catch((err) => { alert(err) })



      socket.emit('sendMessage', msgObj);
      setMessage('');
    }
  };

  const getRecipient = (userId) => {
    fetch(`${backendUrl}/getRecipient`, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userId }) })
      .then((response) => { return response.json() })
      .then((data) => {
        setRecipient(data.user)
      })
      .catch((err) => { alert(err) })
  }

  const getRecentChats = (_id) => {
    fetch(`${backendUrl}/getRecentChats`, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: _id }) })
      .then((response) => { return response.json() })
      .then((data) => { setRecentChats(data.recentChats) })
  }

  const getHistory = (_id) => {
    fetch(`${backendUrl}/getHistory`, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: _id }) })
      .then((response) => { return response.json() })
      .then((data) => { setGlobalMsgObject(data.data); setUnreadMsgObj(data.loggedInUserInfo.unreadMessages !=undefined ? data.loggedInUserInfo.unreadMessages : {} ) })
  }

  const getPreviousMessages = () => {
    fetch(`${backendUrl}/getPreviousMessages`, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderId: loggedInUser._id, receiverId: recipient._id }) })
      .then((response) => { return response.json() })
      .then((data) => { setPreviousMessages(data.previousMessages) })
  }

  const searchUser = (inputName) => {
    if (inputName != '') {
      fetch(`${backendUrl}/searchUser`, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: inputName }) })
        .then((response) => { return response.json() })
        .then((data) => {
          if (data.message == 'all users') {
            setSearchedUsers(data.users)
          }
        })
        .catch((err) => { console.log('Error getting online users...') })
    }
    else {
      setSearchedUsers([])
    }
  }

  const updateSocketIdInLocalstorage = (socketId) => {
    const user = JSON.parse(localStorage.getItem('user'))
    user.socketId = socketId;
    user.status = 'online'

    localStorage.setItem('user', JSON.stringify(user))
  }

  const clearUnreadMsgsForRecipient = (loggedInUserId, recipientId)=>{
    fetch(`${backendUrl}/clearUnreadMsgsForRecipient`, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: loggedInUserId, recipientId:recipientId }) })

        .then((response) => { return response.json() })
        .then((data) => { console.log(data)})
        .catch((err) => { console.log('Error removing unread msgs for recipient ...') })
  }


  useEffect(() => {  //scrolling when msgs changes
    const lastMsg = document.querySelector('.lastMsg');
    if (lastMsg) {
      lastMsg.scrollIntoView({ behavior: 'smooth' });
      lastMsg.classList.add('scale-100')
    }

  }, [previousMessages]);



  useEffect(() => {  //scrolling when clickedUserInfo changes
    const scrollable = document.getElementById('scrollable')
    scrollable && scrollable.scrollTo(0, scrollable.scrollHeight);
  }, [clickedUserInfo])

  const clearDB = () => {
    fetch(`${backendUrl}/clearDB`, { method: 'post', headers: { 'Content-Type': 'application/json' } })
      .then((response) => { return response.json() })
      .then((data) => {
        console.log(data)
      })
      .catch((err) => { alert(err) })

    localStorage.clear()
  }

  const hangleInputChange = (e) => {

    setMessage(e.target.value);
    socket.emit('iAmTyping', { _id: loggedInUser._id, socketId: recipient.socketId })
  }

  






  return (

    <div className="flex h-screen  bg-gray-900 text-gray-100">
      {/* Sidebar (Recent Chats) */}

      <div className="w-1/3 border-r border-gray-700 bg-gray-800 ">

        <div className="relative flex items-center justify-center border-b border-gray-700 h-[10%] bg-gray-800 ">
          <input id='userSearch' className='outline-none w-[90%] rounded pl-2 p-2 text-gray-300  bg-gray-800 font-semibold' type="text" placeholder='Search User...' onChange={(e) => { searchUser(e.target.value) }} />
          {
            searchedUsers.length >= 1 &&
            <ul className='absolute rounded-md overflow-auto no-scrollbar backdrop-blur-md  flex flex-col gap-2 p-2 bottom-0 w-full top-[100%] h-[300px] border border-gray-700'>
              {
                searchedUsers.map((user, index) => {
                  return <li className={` cursor-pointer rounded flex pl-2 bg-gray-800 items-center w-full border border-gray-700  backdrop-blur-md h-8 ${loggedInUser.username === user.username ? 'hidden' : ''}`} key={index} onClick={() => { getRecipient(user._id); localStorage.setItem('clickedUser', user._id); setClickedUserInfo(user); setRecipient(user); setSearchedUsers([]); document.getElementById('userSearch').value = '' }}>{user.username}</li>
                })
              }
            </ul>
          }
        </div>

        {/* Recent Chats List */}


        <div className=" h-[80%] w-full overflow-y-auto no-scrollbar ">
          {/* Chat Item */}

          {
            globalMsgObject && globalMsgObject.map((obj, index) => {
              const lastMsgTime = new Date(obj.messages[obj.messages.length-1].createdAt)
              return <div key={index} className={`p-4  border-b border-gray-700  cursor-pointer hover:bg-gray-700 ${loggedInUser.username === obj.user.username ? 'hidden' : ''} ${clickedUserInfo && clickedUserInfo.username === obj.user.username ? 'bg-gray-700' : ''}  `} onClick={() => {clearUnreadMsgsForRecipient(loggedInUser._id ,obj.user._id); setClickedRecentChat(obj.user); getRecipient(obj.user._id); localStorage.setItem('clickedUser', obj.user._id); setClickedUserInfo(obj.user); setRecipient(obj.user); setPreviousMessages(obj.messages); localStorage.setItem('clickedUser', obj.user._id) }}>
                      <div className="flex w-full  items-center">
                        <div className={` min-w-12 min-h-12 bg-black rounded-full ${obj.user.status == 'online' || obj.user.status == 'typing...' ? 'border-4 border-green-700' : ''} `} />
                        <div className="ml-3 truncate flex flex-grow flex-col">
                          <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-gray-200">{obj.user.username}</h3>
                            <span className="text-xs text-gray-400">{lastMsgTime.getHours() + ":" +lastMsgTime.getMinutes() }</span>
                          </div>
                          <div className='flex justify-between '>
                            <p className={`text-sm  text-nowrap truncate text-gray-400  w-[80%]  ${obj.user.status === 'typing...'  ? 'text-green-500' : ''} `}>{obj.user.status === 'typing...' ? 'typing...' : `${obj.messages[obj.messages.length-1].content}`}</p>
                            <p className={`flex justify-center items-center ml-4 text-xs font-bold text-black  w-[20px] h-[20px] bg-green-400 rounded-full ${unreadMsgObj[obj.user._id]!=undefined ? '' : 'hidden'}`}>{unreadMsgObj[obj.user._id]!=undefined? unreadMsgObj[obj.user._id].count : ''}</p>
                          </div>
                        </div>
                      </div>
                    </div>
            })
          }

          <button className='absolute bottom-0' onClick={() => { clearDB() }}>clearDB</button>





        </div>


      </div>

      {/* Chat Window */}

      {

        clickedUserInfo._id && <div className="flex-1 flex flex-col">

          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 h-[10%] border-b border-gray-700 bg-gray-800">
            <div className="flex items-center">
              <div className={`w-12 h-12 rounded-full bg-black`}></div>

              <div className="ml-3">
                <h3 className="font-semibold text-gray-200">{clickedUserInfo && clickedUserInfo.username}</h3>
                <p className="text-xs text-gray-400">{clickedUserInfo.status==='offline'? `last seen at ${new Date(clickedUserInfo.lastSeen).getHours() +':'+new Date(clickedUserInfo.lastSeen).getMinutes()}`: clickedUserInfo.status}</p>
              </div>
            </div>
            <button className="text-blue-400 hover:text-blue-600">More</button>
          </div>

          {/* Messages Section */}
          <div id='scrollable' className="flex-1 overflow-y-auto no-scrollbar p-4 bg-gray-900">

            {
              previousMessages.map((msgObject, index) => (

                <div key={index} className={`flex mb-2 ${msgObject.sender?._id === loggedInUser._id ? 'justify-end ' : 'justify-start'}`} >
                  <div className={` ${index == previousMessages.length - 1 ? "lastMsg transition-all duration-300 transform scale-0" : ""}    relative max-w-[75%] p-2 rounded-lg text-white break-words  ${msgObject.sender._id === loggedInUser._id ? 'bg-blue-500 text-white p-3 rounded-lg max-w-xs ml-auto' : 'bg-gray-800 p-3 rounded-lg max-w-xs '}`} >
                    {msgObject.content}
                  </div>
                </div>


              ))}


          </div>

          {/* Input Section */}
          <div className="border-t border-gray-700 p-4 bg-gray-800">
            <div className="flex">
              <input
                type="text"
                className="flex-1 border border-gray-600 rounded-l-lg p-2 bg-gray-700 text-gray-100 placeholder-gray-400 focus:outline-none"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => { hangleInputChange(e) }}
                onKeyDown={(e) => { e.key == 'Enter' ? sendMessage() : '' }}
              />
              <button className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600" onClick={sendMessage}>
                Send
              </button>
            </div>
          </div>

        </div>

      }

    </div>

  )
}

export default Home

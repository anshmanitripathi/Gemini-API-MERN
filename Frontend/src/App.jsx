import React, { useState, useEffect, useRef } from 'react';
import { Menu, WifiOff, Bot } from 'lucide-react';
import { API_URL, COLORS } from './constants';

// Components
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import LoadingIndicator from './components/LoadingIndicator';
import InputBar from './components/InputBar';

export default function App() {
  //STATE
  const [userId, setUserId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  //INIT USER & FETCH HISTORY
  useEffect(() => {
    let storedId = localStorage.getItem('chat_user_id');
    if (!storedId) {
      storedId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chat_user_id', storedId);
    }
    setUserId(storedId);
    fetchChats(storedId);
  }, []);

  //API CALLS
  const fetchChats = async (uid) => {
    try {
      const res = await fetch(`${API_URL}/chats/${uid}`);
      if (!res.ok) throw new Error("Failed to connect");
      const data = await res.json();
      setChats(data);
    } catch (err) {
      console.error("Backend offline?", err);
      setError("Backend disconnected. Ensure server.js is running.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchMessages = async () => {
      if (!activeChatId) {
        if (isMounted) setMessages([]);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/messages/${activeChatId}`);
        const data = await res.json();
        if (isMounted) {
          setMessages(data);
          scrollToBottom();
        }
      } catch (err) { console.error(err); }
    };
    fetchMessages();
    return () => { isMounted = false; };
  }, [activeChatId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  //HANDLERS
  const createNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setPdfFile(null);
    setIsSidebarOpen(false);
  };

  const deleteChat = async (chatId) => {
    try {
      await fetch(`${API_URL}/chats/${chatId}`, { method: 'DELETE' });
      setChats(prev => prev.filter(c => c._id !== chatId));
      if (activeChatId === chatId) createNewChat();
    } catch (err) { console.error("Delete failed", err); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert("Please upload a PDF file.");
        return;
      }
      setPdfFile(file);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && !pdfFile) return;

    const currentInput = input;
    const currentPdf = pdfFile;
    
    setInput("");
    setPdfFile(null);
    setIsLoading(true);

    const tempId = Date.now().toString();
    const tempUserMsg = { 
      role: 'user', 
      content: currentInput + (currentPdf ? ` [Attached: ${currentPdf.name}]` : ""),
      _id: tempId 
    };
    setMessages(prev => [...prev, tempUserMsg]);

    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('content', currentInput);
    if (activeChatId) formData.append('chatId', activeChatId);
    if (currentPdf) formData.append('pdf', currentPdf);

    try {
      const res = await fetch(`${API_URL}/message`, { method: 'POST', body: formData });
      const data = await res.json();
      
      if (!res.ok || data.error) throw new Error(data.error || "Server error");
      if (!data.userMessage || !data.aiMessage) throw new Error("Invalid response");
      
      if (!activeChatId) {
        setMessages(prev => [...prev.filter(m => m._id !== tempId), data.userMessage, data.aiMessage]);
        setActiveChatId(data.chatId);
        fetchChats(userId); 
      } else {
        setMessages(prev => [...prev.filter(m => m._id !== tempId), data.userMessage, data.aiMessage]);
      }
      scrollToBottom();
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev.filter(m => m._id !== tempId),
        { role: 'model', content: `Error: ${err.message || "Could not reach server."}`, _id: Date.now() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ backgroundColor: COLORS.bgMain }}>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
          body { font-family: 'Outfit', sans-serif; }`}
      </style>

      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        startNewChat={createNewChat}
        chats={chats}
        activeChatId={activeChatId}
        setActiveChat={(chat) => setActiveChatId(chat._id)}
        deleteChat={deleteChat}
      />

      <div className="flex-1 p-2 md:p-5 flex flex-col h-full relative">
        
        {/* Navbar */}
        <div className="md:hidden h-16 flex items-center px-4 justify-between bg-[#E8D1C5] rounded-xl mb-2">
           <button onClick={() => setIsSidebarOpen(true)} className="text-[#452829]">
             <Menu />
           </button>
           <span className="font-bold text-[#452829]">MY-AI</span>
           <div className="w-6"></div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 bg-[#F3E8DF] rounded-[2rem] shadow-xl border border-[#452829]/5 flex flex-col overflow-hidden relative">
          
          {/* Chat Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-64 scrollbar-thin">
            {error && (
               <div className="bg-red-50 border border-red-100 text-[#452829] px-4 py-3 rounded-xl relative mb-4 flex items-center gap-2 mx-auto max-w-2xl text-sm shadow-sm" role="alert">
                  <WifiOff size={16} />
                  <span className="block sm:inline font-medium">{error}</span>
               </div>
            )}

            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-100 animate-in fade-in duration-1000 pb-20">
                 <div className="w-20 h-20 bg-[#452829] rounded-[2rem] flex items-center justify-center shadow-2xl shadow-[#452829]/20 mb-8 rotate-3">
                   <Bot size={32} className="text-[#F3E8DF]" />
                 </div>
                 <h2 className="text-3xl font-bold text-[#452829] mb-3 tracking-tight">MY-AI Workspace</h2>
                 <p className="text-[#57595B] font-medium tracking-wide text-sm max-w-xs mx-auto leading-relaxed">
                   Your intelligent canvas for thoughts and documents.
                 </p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto ">
                {messages.map((msg, idx) => (
                  <MessageBubble key={msg._id || idx} role={msg.role} content={msg.content} />
                ))}
                {isLoading && <LoadingIndicator />}
                <div ref={messagesEndRef} />
                <div className="h-24" />
              </div>
            )}
          </div>

          {/* Input Bar */}
          <InputBar 
            input={input}
            setInput={setInput}
            handleKeyDown={handleKeyDown}
            sendMessage={sendMessage}
            isLoading={isLoading}
            pdfFile={pdfFile}
            setPdfFile={setPdfFile}
            fileInputRef={fileInputRef}
            handleFileUpload={handleFileUpload}
          />
        </div>
      </div>
    </div>
  );
}
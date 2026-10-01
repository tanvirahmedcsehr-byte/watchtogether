import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Shield, Smile, Trash2, EyeOff } from 'lucide-react';
import { ChatMessage } from '../../types';
import { sendChatMessage, deleteChatMessage, clearAllChat } from '../../lib/services/chat';

interface LiveChatProps {
  sessionId: string;
  displayLabel: string;
  isHost?: boolean;
  chatEnabled?: boolean;
  messages: ChatMessage[];
}

export const LiveChat: React.FC<LiveChatProps> = ({
  sessionId,
  displayLabel,
  isHost = false,
  chatEnabled = true,
  messages,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatEnabled || !inputText.trim() || isSending) return;

    const text = inputText;
    setInputText('');
    setIsSending(true);

    try {
      await sendChatMessage(sessionId, displayLabel, text);
    } catch (err) {
      console.error('Failed to send chat message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMsg = async (msgId: string) => {
    if (!isHost) return;
    try {
      await deleteChatMessage(msgId);
    } catch (e) {
      console.error('Failed to delete message:', e);
    }
  };

  const handleClearChat = async () => {
    if (!isHost) return;
    try {
      await clearAllChat();
      setShowClearConfirm(false);
    } catch (e) {
      console.error('Failed to clear chat:', e);
    }
  };

  const formatMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-white">Live Channel Chat</h3>
        </div>

        <div className="flex items-center gap-2">
          {isHost && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[11px] text-neutral-400 hover:text-rose-400 transition-colors p-1"
              title="Clear all chat messages"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <span className="text-neutral-500 font-mono">You:</span>
            <span className={`font-semibold ${isHost ? 'text-purple-400' : 'text-neutral-200'}`}>
              {displayLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Clear Confirmation for Host */}
      {showClearConfirm && (
        <div className="p-2.5 bg-rose-950/80 border-b border-rose-800/80 flex items-center justify-between text-xs text-rose-200">
          <span>Clear all channel messages?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleClearChat}
              className="px-2 py-0.5 rounded bg-rose-600 text-white font-semibold hover:bg-rose-500 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 space-y-2">
            <Smile className="w-8 h-8 text-neutral-600" />
            <p className="text-xs">
              Welcome to the live chat! Say hello to everyone watching the stream.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sessionId === sessionId;
            const isMsgHost = msg.displayLabel.toLowerCase().includes('host');

            return (
              <div
                key={msg.id}
                className={`group/msg flex flex-col ${isMe ? 'items-end' : 'items-start'} text-xs relative`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-neutral-400">
                  {isMsgHost && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold text-[10px]">
                      <Shield className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                  <span className={`font-medium ${isMe ? 'text-rose-400' : 'text-neutral-300'}`}>
                    {msg.displayLabel}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {formatMessageTime(msg.createdAt)}
                  </span>

                  {isHost && (
                    <button
                      onClick={() => handleDeleteMsg(msg.id)}
                      className="opacity-0 group-hover/msg:opacity-100 hover:text-rose-400 p-0.5 transition-opacity"
                      title="Delete message"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div
                  className={`px-3.5 py-2 rounded-2xl max-w-[85%] break-words leading-relaxed text-sm ${
                    isMe
                      ? 'bg-rose-600 text-white rounded-tr-xs'
                      : isMsgHost
                      ? 'bg-purple-950/60 border border-purple-800/60 text-purple-100 rounded-tl-xs'
                      : 'bg-neutral-800 text-neutral-200 rounded-tl-xs'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-900">
        {chatEnabled ? (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Comment on the live stream…"
              maxLength={500}
              className="flex-1 bg-neutral-950 border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all cursor-pointer active:scale-95 shrink-0"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="py-2 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
            <EyeOff className="w-3.5 h-3.5" />
            <span>Chat is turned off by host</span>
          </div>
        )}
      </div>
    </div>
  );
};

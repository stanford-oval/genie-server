import React, { useState, useEffect, useRef } from 'react';

import WebSocket from 'isomorphic-ws';

import ChatFooter from './ChatFooter';
import ChatFeed from './ChatFeed';
import { MessageType } from './messages/Message';
import './ChatInterface.scss';

const ChatInterface: React.FC = () => {
  const [messageHistory, setMessageHistory] = useState([] as MessageType[]);
  const [waitingForResponse, setWaiting] = useState(false);

  const almondURL = 'almond.stanford.edu/me/api/anonymous';
  const headers = {
    Origin: `https://${almondURL}`
  };
  const socket = useRef(new WebSocket(`wss://${almondURL}`, [], { headers }));

  useEffect(() => {
    socket.current.onmessage = msg => {
      setWaiting(false);

      const incomingMessage: MessageType = {
        by: 'Other',
        data: JSON.parse(msg.data as any),
        time: new Date(Date.now())
      };
      setMessageHistory(messageHistory.concat([incomingMessage]));
    };
  });

  // Close socket when component is unmounted.
  useEffect(() => () => socket.current.close(), [socket]);

  const handleMessageSubmit = (text: string) => {
    const newOutMessage = {
      type: 'command',
      text
    };
    setWaiting(true);
    socket.current.send(JSON.stringify(newOutMessage));

    const newMessage: MessageType = {
      data: {
        type: 'text',
        text
      },
      time: new Date(Date.now()),
      by: 'User'
    };
    setMessageHistory(messageHistory.concat(newMessage));
  };

  return (
    <div className="chat-container">
      <ChatFeed
        messages={messageHistory}
        waitingForResponse={waitingForResponse}
      />
      <ChatFooter handleMessageSubmit={handleMessageSubmit} />
    </div>
  );
};

export default ChatInterface;

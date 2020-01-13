import React, { useState, useEffect, useRef } from 'react';

import WebSocket from 'isomorphic-ws';

import ChatFooter from './ChatFooter';
import ChatFeed from './ChatFeed';
import { MessageType } from './messages/Message';

const ChatInterface: React.FC = () => {
  const [messageHistory, setMessageHistory] = useState([] as MessageType[]);

  const almondURL = 'almond.stanford.edu/me/api/anonymous';
  const headers = {
    Origin: `https://${almondURL}`
  };
  const socket = useRef(new WebSocket(`wss://${almondURL}`, [], { headers }));

  useEffect(() => {
    socket.current.onmessage = msg => {
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
    <div>
      <ChatFeed messages={messageHistory} />
      <ChatFooter handleMessageSubmit={handleMessageSubmit} />
    </div>
  );
};

export default ChatInterface;

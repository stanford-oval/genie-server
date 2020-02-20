import React, { useState, useEffect, useRef } from 'react';

import { useImmer } from 'use-immer';
import WebSocket from 'isomorphic-ws';

import ChatFooter from './ChatFooter';
import ChatFeed from './ChatFeed';
import { MessageType } from './messages/Message';
import './ChatInterface.scss';

const ChatInterface: React.FC = () => {
  const [messageHistory, updateMessageHistory] = useImmer([] as MessageType[]);
  const [waitingForResponse, setWaiting] = useState(false);

  const almondURL = 'almond-dev.stanford.edu/me/api/conversation';
  const socket = useRef(new WebSocket(`wss://${almondURL}?access_token=${process.env.REACT_APP_ACCESS_TOKEN}`, []));

  useEffect(() => {
    socket.current.onmessage = msg => {
      setWaiting(false);

      const incomingMessage: MessageType = {
        by: 'Other',
        data: JSON.parse(msg.data as any),
        time: new Date(Date.now())
      };
      updateMessageHistory(draft => {
        draft.push(incomingMessage)
        return draft;
      });
      console.log(messageHistory)
    };

    /*
    socket.current.onerror = e => {
      console.log(`Socket error. ${e}`);
    };
    */
  }, [messageHistory]);

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
    updateMessageHistory(draft => {
      draft.push(newMessage)
      return draft;
    });
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

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

  const almondURL = 'localhost:3000/api/conversation';
  const socket = useRef(new WebSocket(`ws://${almondURL}`, []));

  useEffect(() => {
    socket.current.onmessage = (msg): void => {
      const incomingMessage: MessageType = {
        by: 'Other',
        data: JSON.parse(msg.data as any),
        time: new Date(Date.now())
      };

      // Don't display echoed commands
      if (incomingMessage.data.type === 'command') return;

      //console.log(incomingMessage);
      updateMessageHistory(draft => {
        draft.push(incomingMessage);
        return draft;
      });

      setWaiting(false);
      console.log(messageHistory);
    };

    /*
    socket.current.onerror = e => {
      console.log(`Socket error. ${e}`);
    };
    */
  }, [messageHistory]);

  // Close socket when component is unmounted.
  useEffect(() => (): void => socket.current.close(), [socket]);

  const handleMessageSubmit = (text: string, json?: any): void => {
    const newOutMessage: any = {
    };

    if (json) {
      newOutMessage.type = 'parsed';
      newOutMessage.json = json;
    } else {
      newOutMessage.type = 'command';
      newOutMessage.text = text;
    }

    console.log('NEW MESSAGE!');
    console.log(JSON.stringify(newOutMessage));

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
      draft.push(newMessage);
      return draft;
    });
  };

  return (
    <div className="chat-container">
      <ChatFeed
        sendMessage={handleMessageSubmit}
        messages={messageHistory}
        waitingForResponse={waitingForResponse}
      />
      <ChatFooter handleMessageSubmit={handleMessageSubmit} />
    </div>
  );
};

export default ChatInterface;

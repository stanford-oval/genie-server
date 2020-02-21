import React, { useEffect } from 'react';

import { animateScroll } from 'react-scroll';

import Message, { MessageType } from './messages/Message';
import './ChatFeed.scss';

interface ChatFeedProps {
  messages: MessageType[];
  waitingForResponse: boolean;
  sendMessage: (text: string, json?: any) => void;
}

const ChatFeed: React.FC<ChatFeedProps> = props => {
  useEffect(() => {
    animateScroll.scrollToBottom({
      containerId: 'feed',
      duration: 100
    });
  }, [props.messages]);

  const messages = props.messages.map(m => (
    <Message
      key={m.time.getTime()}
      data={m.data}
      time={m.time}
      by={m.by}
      sendMessage={props.sendMessage}
    />
  ));

  const now = new Date(Date.now());

  return (
    <div id="feed" className="chat-feed">
      {messages}
      {props.waitingForResponse ? (
        <Message
          key={now.getTime()}
          data={{ type: 'pending' }}
          time={now}
          by={'Other'}
          sendMessage={props.sendMessage}
        />
      ) : null}
    </div>
  );
};

export default ChatFeed;

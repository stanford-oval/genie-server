import React, { useEffect } from 'react';

import { animateScroll } from 'react-scroll';

import Message, { MessageType } from './messages/Message';
import './ChatFeed.scss';

interface ChatFeedProps {
  messages: MessageType[];
  waitingForResponse: boolean;
}

const ChatFeed: React.FC<ChatFeedProps> = props => {
  useEffect(() => {
    animateScroll.scrollToBottom({
      containerId: 'feed',
      duration: 100
    });
  }, [props.messages]);

  const messages = props.messages.map(m => (
    <Message key={m.time.getTime()} data={m.data} time={m.time} by={m.by} />
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
        />
      ) : null}
    </div>
  );
};

export default ChatFeed;

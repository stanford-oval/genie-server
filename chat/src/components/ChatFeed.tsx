import React from 'react';

import Message, { MessageType } from './messages/Message';

interface ChatFeedProps {
  messages: MessageType[];
}

const ChatFeed: React.FC<ChatFeedProps> = props => {
  const messages = props.messages.map(m => (
    <Message key={m.time.getTime()} data={m.data} time={m.time} by={m.by} />
  ));

  return <div>{messages}</div>;
};

export default ChatFeed;

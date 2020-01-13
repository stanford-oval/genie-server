import React from 'react';

import Message from './messages/Message';

export interface MessageType {
  key?: number;
  by: string;
  data: any;
  time: Date;
}

interface MessageFeedProps {
  messages: MessageType[];
}

const MessageFeed: React.FC<MessageFeedProps> = props => {
  const messages = props.messages.map(m => (
    <Message key={m.time.getTime()} data={m.data} time={m.time} by={m.by} />
  ));

  return <div>{messages}</div>;
};

export default MessageFeed;

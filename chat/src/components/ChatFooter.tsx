import React from 'react';

import MessageInput from './MessageInput';

interface ChatFooterProps {
  handleMessageSubmit: (d: any) => void;
}

const ChatFooter: React.FC<ChatFooterProps> = props => {
  return (
    <div>
      <MessageInput handleSubmit={props.handleMessageSubmit} />
    </div>
  );
};

export default ChatFooter;

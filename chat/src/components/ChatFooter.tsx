import React from 'react';

import ChatInput from './ChatInput';

interface ChatFooterProps {
  handleMessageSubmit: (d: any) => void;
}

const ChatFooter: React.FC<ChatFooterProps> = props => {
  return (
    <div>
      <ChatInput handleSubmit={props.handleMessageSubmit} />
    </div>
  );
};

export default ChatFooter;

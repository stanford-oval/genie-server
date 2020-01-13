import React from 'react';

import ChatInput from './ChatInput';
import './ChatFooter.scss';

interface ChatFooterProps {
  handleMessageSubmit: (d: any) => void;
}

const ChatFooter: React.FC<ChatFooterProps> = props => {
  return (
    <div className="chat-footer">
      <ChatInput handleSubmit={props.handleMessageSubmit} />
    </div>
  );
};

export default ChatFooter;

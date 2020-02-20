import React from 'react';

import { useForm } from 'react-hook-form';

import './ChatInput.scss';
import MicInputButton from './MicInputButton';

interface ChatInputProps {
  handleSubmit: (d: any) => void;
}

const ChatInput: React.FC<ChatInputProps> = props => {
  const { register, handleSubmit, setValue, watch, errors } = useForm();
  const onSubmit = (d: any) => {
    setValue('messageText', '');
    props.handleSubmit(d.messageText);
  };

  return (
    <div className="chat-input">
      <form onSubmit={handleSubmit(onSubmit)}>
        <input
          name="messageText"
          type="text"
          placeholder="Send a message."
          ref={register}
        />
        <input type="submit" style={{ display: 'none' }} />
      </form>
      <MicInputButton submit={props.handleSubmit} />
    </div>
  );
};

export default ChatInput;

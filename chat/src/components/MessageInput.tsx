import React from 'react';
import { useForm } from 'react-hook-form';

interface MessageInputProps {
  handleSubmit: (d: any) => void;
}

const MessageInput: React.FC<MessageInputProps> = props => {
  const { register, handleSubmit, setValue, watch, errors } = useForm();
  const onSubmit = (d: any) => {
    setValue('messageText', '');
    props.handleSubmit(d.messageText);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        name="messageText"
        type="text"
        placeholder="Send a message."
        ref={register}
      />
      <input type="submit" style={{ display: 'none' }} />
    </form>
  );
};

export default MessageInput;

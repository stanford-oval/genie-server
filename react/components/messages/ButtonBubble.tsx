import React from 'react';

import './ButtonBubble.scss';

interface ButtonBubbleProps {
  text: string;
  fromUser: boolean;
  json: any; // message executable
  sendMessage: (text: string, json?: any) => void;
}

export default (props: ButtonBubbleProps) => {
  const handleClick = (): void => {
    props.sendMessage(props.text, props.json);
  };

  return <button onClick={handleClick}>{props.text}</button>;
};

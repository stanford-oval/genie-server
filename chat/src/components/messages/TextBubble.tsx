import React from 'react';

import Bubble from './Bubble';
import './TextBubble.scss';

interface TextBubbleProps {
  text: string;
  fromUser: boolean;
}

export default (props: TextBubbleProps) => {
  return (
    <Bubble fromUser={props.fromUser}>
      <p className="text-bubble-content">{props.text}</p>
    </Bubble>
  );
};

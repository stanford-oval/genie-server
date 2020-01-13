import React from 'react';

import Bubble from './Bubble';

interface TextBubbleProps {
  text: string;
}

export default (props: TextBubbleProps) => {
  return (
    <Bubble>
      {props.text}
    </Bubble>
  );
};

import React from 'react';

import Bubble from './Bubble';
import TextBubble from './TextBubble';

export interface MessageType {
  key?: number;
  by: string;
  data: any;
  time: Date;
}

interface Props {
  by: string;
  data: any;
  time: Date;
}

const renderBubble = (data: any) => {
  let bubble;

  switch (data.type) {
    case 'text':
      bubble = <TextBubble text={data.text} />;
      break;
    default:
      bubble = <TextBubble text={JSON.stringify(data)} />;
  }

  return bubble;
};

const Message: React.FC<Props> = props => {
  const bubble = renderBubble(props.data);
  return (
    <div>
      <p>{props.by}</p>
      {bubble}
      <p>{props.time.toDateString()}</p>
    </div>
  );
};

export default Message;

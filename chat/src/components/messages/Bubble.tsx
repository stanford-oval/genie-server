import React from 'react';

import './Bubble.scss';

interface Props {
  children: React.ReactNode;
  className?: string;
  fromUser: boolean;
  padding?: boolean;
}

export default (props: Props) => {
  return (
    <div
      className={`bubble ${props.fromUser ? 'user' : 'other'} ${
        props.padding ? 'bubble-padding' : ''
      } ${props.className}`}
    >
      {props.children}
    </div>
  );
};

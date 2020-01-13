import React from 'react';

import './Bubble.scss';

interface Props {
  children: React.ReactNode;
  fromUser: boolean;
}

export default (props: Props) => {
  return (
    <div className={`bubble ${props.fromUser ? 'user' : 'other'}`}>
      {props.children}
    </div>
  );
};

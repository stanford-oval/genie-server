import React from 'react';

interface Props {
  children: React.ReactNode;
}

export default (props: Props) => {
  return <div>{props.children}</div>;
};

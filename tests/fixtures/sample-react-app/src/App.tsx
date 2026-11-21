import React from 'react';
import axios from 'axios';
import moment from 'moment';
import { v4 } from 'uuid'; // missing dependency!

export const App = () => {
  const date = moment().format('YYYY-MM-DD');
  return <div>{date} {v4()}</div>;
};

import ReactDOM from 'react-dom/client';
import { App } from './App';
import { debounce } from 'lodash';

const render = debounce(() => {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(<App />);
}, 100);

render();

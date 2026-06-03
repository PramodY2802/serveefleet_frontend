import { render } from '@testing-library/react';
import App from './App';

test('renders the AutoPulse application root', () => {
  const { container } = render(<App />);
  expect(container).toBeInTheDocument();
});

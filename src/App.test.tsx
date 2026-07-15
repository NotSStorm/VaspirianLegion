import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('app shell', () => {
  it('renders the home page content', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Grand Andouran Battery/i).length).toBeGreaterThan(0);
  });
});

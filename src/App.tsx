import { AppLayout } from './components/layout/AppLayout';
import { useTypeInference } from './hooks/useTypeInference';

function AppWithHooks() {
  useTypeInference();
  return <AppLayout />;
}

export default function App() {
  return <AppWithHooks />;
}

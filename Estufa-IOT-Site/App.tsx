import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from "./components/layout";
import Dashboard from "./pages/dashboard";
import Historico from "./pages/historico";
import Alertas from "./pages/alertas";



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-6 animate-in fade-in">
      <div className="text-8xl font-serif font-black text-primary/20">404</div>
      <h1 className="text-3xl font-serif font-bold text-foreground">Trilha não encontrada</h1>
      <p className="text-lg text-foreground/70 max-w-md">
        Parece que você se perdeu no jardim. Esta seção da estufa não existe.
      </p>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/historico" component={Historico} />
        <Route path="/alertas" component={Alertas} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
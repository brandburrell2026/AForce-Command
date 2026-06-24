import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Manifesto from "@/pages/Manifesto";
import Science from "@/pages/Science";
import Founders from "@/pages/Founders";
import OS from "@/pages/OS";
import Investors from "@/pages/Investors";
import Contact from "@/pages/Contact";
import Products from "@/pages/Products";
import Privacy from "@/pages/Privacy";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/manifesto" component={Manifesto} />
      <Route path="/science" component={Science} />
      <Route path="/founders" component={Founders} />
      <Route path="/os" component={OS} />
      <Route path="/investors" component={Investors} />
      <Route path="/contact" component={Contact} />
      <Route path="/products" component={Products} />
      <Route path="/shop" component={Products} />
      <Route path="/privacy" component={Privacy} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

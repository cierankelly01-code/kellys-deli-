import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { boardCount, loadCart } from "../lib/cart";
import { CART_CHANGED_EVENT, openCartDrawer } from "./CartDrawer";

/**
 * Phone-only bar pinned to the bottom once something's in the basket: the basket and the
 * checkout stay one thumb-tap away while scrolling a long menu. Hidden on desktop, where
 * the header basket is always in view.
 */
export function BasketBar() {
  const navigate = useNavigate();
  const [count, setCount] = useState(() => {
    const c = loadCart();
    return c ? boardCount(c) : 0;
  });

  useEffect(() => {
    const refresh = () => {
      const c = loadCart();
      setCount(c ? boardCount(c) : 0);
    };
    window.addEventListener(CART_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (count === 0) return null;
  return (
    <div className="basket-bar" role="region" aria-label="Your basket">
      <button type="button" className="basket-bar-view" onClick={openCartDrawer}>
        <span className="basket-bar-count">{count}</span> in your basket
      </button>
      <button type="button" className="btn basket-bar-go" onClick={() => navigate("/order")}>Checkout</button>
    </div>
  );
}

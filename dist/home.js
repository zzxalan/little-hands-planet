'use strict';
(() => {
  const filters=[...document.querySelectorAll('[data-filter]')];
  const cards=[...document.querySelectorAll('[data-category]')];
  filters.forEach(button=>button.addEventListener('click',()=>{
    const filter=button.dataset.filter;
    filters.forEach(b=>{const active=b===button;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    cards.forEach(card=>{card.hidden=filter!=='all'&&card.dataset.category!==filter;});
  }));
})();

(function(){
  const menu=document.querySelector('.menu');
  const nav=document.querySelector('nav');
  if(menu&&nav){menu.addEventListener('click',()=>{nav.style.display=nav.style.display==='flex'?'none':'flex';nav.style.flexDirection='column';nav.style.position='absolute';nav.style.right='4vw';nav.style.top='72px';nav.style.background='#fff';nav.style.padding='14px 22px';nav.style.border='1px solid #dbe3ea';nav.style.boxShadow='0 12px 28px rgba(7,28,53,.12)';});}
  const obs=new IntersectionObserver(entries=>entries.forEach(e=>e.isIntersecting&&e.target.classList.add('show')),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
})();

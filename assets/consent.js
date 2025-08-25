document.addEventListener('DOMContentLoaded',function(){
  var modal=document.getElementById('policyModal');
  if(!modal){return;}
  function close(){ modal.style.display='none'; }
  document.getElementById('acceptPolicy').addEventListener('click', close);
  document.getElementById('closePolicy').addEventListener('click', close);
  // Always show on each load (no storage), per request
});
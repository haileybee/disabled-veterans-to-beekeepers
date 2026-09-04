export function filterChatMessages(messages=[],query=''){
  const term=String(query||'').trim().toLowerCase();
  if(!term)return Array.isArray(messages)?messages:[];
  return (Array.isArray(messages)?messages:[]).filter(message=>{
    const name=String(message?.display_name||'').toLowerCase();
    const body=String(message?.body||'').toLowerCase();
    return name.includes(term)||body.includes(term);
  });
}

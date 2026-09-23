const res = await fetch('http://localhost:3000');
console.log('Status:', res.status);
const text = await res.text();
console.log('HTML Length:', text.length);
console.log('Has sound-toggle:', text.includes('id="sound-toggle"'));
console.log('Has open-calibrator:', text.includes('id="open-calibrator"'));
console.log('Has loc-status-0:', text.includes('id="loc-status-0"'));
console.log('Has tear-handle:', text.includes('id="tear-handle"'));
console.log('Has calibrator-modal css:', text.includes('calibrator-modal') || text.includes('hdr-sound'));

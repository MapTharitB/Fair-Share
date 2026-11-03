import {measureChoiceGroup,observeChoices} from './choice-layout.mjs';
import {openSheet} from './in-app-confirm.mjs';
let active=null;
// Use the actual font and available group width, including enlarged text.
function mountOptionLayout(dialog){
  function update(){
    const layouts=[...dialog.querySelectorAll('.segmented')].map(group=>({group,stacked:measureChoiceGroup(group)>group.getBoundingClientRect().width}));
    for(const {group,stacked} of layouts)group.classList.toggle('segmented-stacked',stacked);
  }
  return observeChoices(dialog,update);
}
// Shared sheet owns cancellation, focus and asynchronous retry.
export function openReceiptImport({mode='append',assignmentMode='all',onConfirm}){
  return openSheet({title:'วิธีเพิ่มเมนูลงในบิลเดิม',className:'receipt-options',body:`
    <fieldset><legend>รายการอาหาร</legend><div class="segmented">
      <label class="segmented-option"><input type="radio" name="food-mode" value="append"><span class="segmented-face">เพิ่มต่อจากบิลเดิม</span></label>
      <label class="segmented-option"><input type="radio" name="food-mode" value="replace"><span class="segmented-face">แทนที่เมนูเดิม</span></label></div></fieldset>
    <fieldset><legend>คนที่กิน</legend><div class="segmented">
      <label class="segmented-option"><input type="radio" name="people-mode" value="all"><span class="segmented-face">แบ่งให้ทุกคน</span></label>
      <label class="segmented-option"><input type="radio" name="people-mode" value="none"><span class="segmented-face">เลือกเองภายหลัง</span></label></div></fieldset>`,
    actions:[{label:'ยกเลิก',value:false,data:{cancel:''}},{label:'ตกลง',className:'sheet-primary',data:{confirm:''},run:async host=>{await onConfirm({mode:host.body.querySelector('[name="food-mode"]:checked').value,assignmentMode:host.body.querySelector('[name="people-mode"]:checked').value});return true;}}],
    fallback:()=>document.getElementById('submitBtn'),
    mount:host=>{host.heading.id='receipt-options-title';host.dialog.setAttribute('aria-labelledby',host.heading.id);host.body.querySelector(`[name="food-mode"][value="${mode}"]`).checked=true;host.body.querySelector(`[name="people-mode"][value="${assignmentMode}"]`).checked=true;return mountOptionLayout(host.dialog);}
  });
}

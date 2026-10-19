/**
 * ContextualReplies Service
 * ─────────────────────────
 * Computes contextual smart quick-reply chips mirroring Google Pixel Call Screen.
 */

export interface QuickReplyChip {
  id: string;
  label: string;
  speechText: string;
  actionType: 'REPLY' | 'HANGUP' | 'PICKUP';
}

export function generateQuickReplies(callerUtterance: string): QuickReplyChip[] {
  const clean = (callerUtterance || '').toLowerCase();

  if (clean.includes('delivery') || clean.includes('package') || clean.includes('courier') || clean.includes('amazon') || clean.includes('fedex') || clean.includes('ups')) {
    return [
      { id: 'leave_door', label: 'Leave at door', speechText: 'Please leave the package at the front door. Thank you.', actionType: 'REPLY' },
      { id: 'signature_check', label: 'Signature required?', speechText: 'Does this package require an in-person signature?', actionType: 'REPLY' },
      { id: 'call_back_later', label: 'Call back later', speechText: 'The recipient is currently away and will call you back shortly.', actionType: 'REPLY' },
      { id: 'take_message', label: 'Take a message', speechText: 'Please leave a message with tracking or delivery details.', actionType: 'REPLY' },
    ];
  }

  if (clean.includes('appointment') || clean.includes('doctor') || clean.includes('hospital') || clean.includes('clinic') || clean.includes('dentist')) {
    return [
      { id: 'confirm_appt', label: 'Confirm appointment', speechText: 'The recipient confirms the appointment. Thank you.', actionType: 'REPLY' },
      { id: 'reschedule_appt', label: 'Need to reschedule', speechText: 'The recipient needs to reschedule. Please provide available dates.', actionType: 'REPLY' },
      { id: 'send_sms', label: 'Send SMS details', speechText: 'Could you please send the appointment details via text message?', actionType: 'REPLY' },
      { id: 'take_message', label: 'Take a message', speechText: 'Please leave any preparation notes or instructions.', actionType: 'REPLY' },
    ];
  }

  if (clean.includes('bank') || clean.includes('card') || clean.includes('fraud') || clean.includes('account') || clean.includes('loan')) {
    return [
      { id: 'verify_org', label: 'Which bank?', speechText: 'Could you state the exact institution and verified department?', actionType: 'REPLY' },
      { id: 'send_mail', label: 'Send written notice', speechText: 'Please mail official documentation to the address on file.', actionType: 'REPLY' },
      { id: 'call_official', label: 'I will call official #', speechText: 'The recipient will verify and call back using the official customer service number.', actionType: 'REPLY' },
      { id: 'hang_up', label: 'Hang up', speechText: 'We are not interested. Goodbye.', actionType: 'HANGUP' },
    ];
  }

  if (clean.includes('offer') || clean.includes('promotion') || clean.includes('warranty') || clean.includes('solar') || clean.includes('survey')) {
    return [
      { id: 'not_interested', label: 'Not interested', speechText: 'The recipient is not interested. Please remove this number from your list.', actionType: 'REPLY' },
      { id: 'do_not_call', label: 'Do not call again', speechText: 'Please add this number to your Do Not Call registry immediately.', actionType: 'REPLY' },
      { id: 'hang_up', label: 'End call', speechText: 'Thank you, goodbye.', actionType: 'HANGUP' },
    ];
  }

  return [
    { id: 'ask_who', label: "Who's calling?", speechText: 'Could you please state your full name and company?', actionType: 'REPLY' },
    { id: 'ask_regarding', label: 'What regarding?', speechText: 'Could you please explain what this call is regarding?', actionType: 'REPLY' },
    { id: 'ask_urgent', label: 'Is it urgent?', speechText: 'Is this an urgent matter?', actionType: 'REPLY' },
    { id: 'take_message', label: 'Take message', speechText: 'The recipient cannot take the call right now. Please leave a message.', actionType: 'REPLY' },
  ];
}

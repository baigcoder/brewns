import { kv } from './store';
import { randomBytes } from 'node:crypto';

export interface VoiceCallMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface VoiceCallAction {
  type: 'ADD_TO_BAG' | 'RESERVE_TABLE' | 'BOOK_PARTY' | 'SHOW_MENU' | 'GENERAL';
  data?: any;
}

export interface VoiceCallResponse {
  reply: string;
  audioBase64?: string;
  action?: VoiceCallAction;
  partyBookingCode?: string;
  reservationCode?: string;
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_7cfba4eb49b6d3f3fb919f1ea99094b1f55df7249eebb719';
const DEFAULT_FEMALE_VOICE = process.env.ELEVENLABS_VOICE_ID_FEMALE || 'EXAVITQu4vr4xnSDxMaL'; // Sarah
const DEFAULT_MALE_VOICE = process.env.ELEVENLABS_VOICE_ID_MALE || 'JBFqnCBsd6RMkjVDRZzb'; // George

/** Synthesize speech using ElevenLabs API (eleven_turbo_v2_5 for ultra-low latency & natural audio) */
export async function synthesizeElevenLabsVoice(
  text: string,
  voiceId?: string
): Promise<string | null> {
  if (!ELEVENLABS_API_KEY) return null;
  const targetVoice = voiceId || DEFAULT_FEMALE_VOICE;

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoice}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[ElevenLabs TTS Error]', res.status, err);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:audio/mpeg;base64,${buffer.toString('base64')}`;
  } catch (err: any) {
    console.error('[ElevenLabs Synthesis Exception]', err.message);
    return null;
  }
}

/** Knowledge Base & Intent Classifier for Brewns Café */
export async function processVoiceCallPrompt(
  prompt: string,
  history: VoiceCallMessage[] = [],
  gender: 'female' | 'male' = 'female'
): Promise<VoiceCallResponse> {
  const p = prompt.toLowerCase().trim();
  const voiceId = gender === 'male' ? DEFAULT_MALE_VOICE : DEFAULT_FEMALE_VOICE;
  const isFemale = gender === 'female';
  const conciergeName = isFemale ? 'Sarah' : 'George';

  // 1. GREETING / INITIAL HELLO
  if (!prompt || p === 'hello' || p === 'hi' || p === 'hey' || p === 'call_init' || p.includes('assalam')) {
    const reply = `Assalam-o-Alaikum and welcome to Brewns Coffee House, Lahore! I'm ${conciergeName}, your AI barista and concierge. I can take your food or coffee order for delivery, reserve a table at any of our three counters, or book a private terrace party. How can I help you today?`;
    const audioBase64 = (await synthesizeElevenLabsVoice(reply, voiceId)) || undefined;
    return { reply, audioBase64, action: { type: 'GENERAL' } };
  }

  // 2. PARTY / EVENT BOOKING INTENT
  if (p.includes('party') || p.includes('event') || p.includes('birthday') || p.includes('celebrat') || p.includes('gathering') || p.includes('reception')) {
    const code = `PTY-${Math.floor(1000 + Math.random() * 9000)}`;
    const guestMatch = p.match(/(\d+)\s*(people|guests|persons|friends)/);
    const guests = guestMatch ? parseInt(guestMatch[1], 10) : 12;
    const location = p.includes('dha') ? 'DHA Phase 5' : p.includes('johar') ? 'Johar Town' : 'MM Alam Road (Terrace & Lounge)';

    // Save Party Booking to store
    const partyBooking = {
      id: randomBytes(6).toString('hex'),
      code,
      type: p.includes('birthday') ? 'Birthday Party' : p.includes('corporate') ? 'Corporate Gathering' : 'Private Café Party',
      location,
      guests,
      status: 'confirmed',
      notes: prompt,
      createdAt: Date.now(),
    };
    await kv.hset('party_bookings', partyBooking.id, partyBooking);

    const reply = `Wonderful! We'd love to host your party at Brewns. I've reserved our party package at our ${location} counter for ${guests} guests under booking code ${code}. Our event coordinator will prepare customized catering, specialty coffee baristas, and terrace ambiance.`;
    const audioBase64 = (await synthesizeElevenLabsVoice(reply, voiceId)) || undefined;
    return {
      reply,
      audioBase64,
      partyBookingCode: code,
      action: { type: 'BOOK_PARTY', data: partyBooking },
    };
  }

  // 3. TABLE RESERVATION INTENT
  if (p.includes('table') || p.includes('reserve') || p.includes('booking') || p.includes('seat')) {
    const code = `RES-${Math.floor(1000 + Math.random() * 9000)}`;
    const guestMatch = p.match(/(\d+)\s*(people|guests|person)/);
    const guests = guestMatch ? parseInt(guestMatch[1], 10) : 2;
    const locName = p.includes('dha') ? 'CCA DHA Phase 5' : p.includes('johar') ? 'Main Boulevard Johar Town' : 'MM Alam Road Gulberg';
    const locId = p.includes('dha') ? 1 : p.includes('johar') ? 2 : 0;
    const timeMatch = p.match(/(\d{1,2}(:\d{2})?\s*(am|pm)?)/i);
    const time = timeMatch ? timeMatch[0] : '8:00 PM';

    const reservation = {
      id: randomBytes(6).toString('hex'),
      code,
      name: 'Voice Guest',
      phone: '0300-1234567',
      email: 'voice@brewns.coffee',
      loc: locId,
      date: new Date().toISOString().split('T')[0],
      time,
      guests,
      area: (p.includes('terrace') ? 'terrace' : p.includes('bar') ? 'bar' : 'indoor') as 'indoor' | 'terrace' | 'bar',
      notes: `Booked via ElevenLabs AI Call: "${prompt}"`,
      status: 'confirmed' as const,
      createdAt: Date.now(),
    };

    await kv.hset('reservations', reservation.id, reservation);

    const reply = `Your table is all set! I've confirmed a reservation for ${guests} guests at our ${locName} counter for ${time} under code ${code}. We look forward to welcoming you with fresh pour-overs and warm hospitality!`;
    const audioBase64 = (await synthesizeElevenLabsVoice(reply, voiceId)) || undefined;
    return {
      reply,
      audioBase64,
      reservationCode: code,
      action: { type: 'RESERVE_TABLE', data: reservation },
    };
  }

  // 4. ORDER / FOOD / COFFEE / DELIVERY INTENT
  if (p.includes('order') || p.includes('delivery') || p.includes('deliver') || p.includes('burger') || p.includes('pizza') || p.includes('pasta') || p.includes('latte') || p.includes('coffee') || p.includes('matcha') || p.includes('roll') || p.includes('bag')) {
    const isDelivery = p.includes('delivery') || p.includes('deliver') || p.includes('send to') || p.includes('home');
    const itemsToAdd: string[] = [];
    const productIds: string[] = [];
    let totalPrice = 0;

    if (p.includes('smash') || p.includes('burger')) {
      itemsToAdd.push('Classic Smash Burger (Rs 1,350)');
      productIds.push('smash-burger');
      totalPrice += 1350;
    }
    if (p.includes('zinger')) {
      itemsToAdd.push('Crispy Zinger Burger (Rs 1,150)');
      productIds.push('zinger-burger');
      totalPrice += 1150;
    }
    if (p.includes('pizza') || p.includes('pepperoni')) {
      itemsToAdd.push('Beef Pepperoni Pizza (Rs 1,950)');
      productIds.push('pepperoni-pizza');
      totalPrice += 1950;
    }
    if (p.includes('alfredo') || p.includes('pasta')) {
      itemsToAdd.push('Chicken Alfredo Fettuccine (Rs 1,450)');
      productIds.push('alfredo-pasta');
      totalPrice += 1450;
    }
    if (p.includes('latte') || p.includes('iced latte')) {
      itemsToAdd.push('Iced Latte (Rs 950)');
      productIds.push('latte');
      totalPrice += 950;
    }
    if (p.includes('matcha')) {
      itemsToAdd.push('Latte (Rs 950)');
      productIds.push('latte');
      totalPrice += 950;
    }
    if (p.includes('cinnamon') || p.includes('cardamom') || p.includes('bun')) {
      itemsToAdd.push('Cardamom Bun (Rs 650)');
      productIds.push('cardamom-bun');
      totalPrice += 650;
    }
    if (p.includes('slow roast') || p.includes('beans')) {
      itemsToAdd.push('Slow Roast Whole Beans 250g (Rs 3,800)');
      productIds.push('slow-roast');
      totalPrice += 3800;
    }

    if (itemsToAdd.length === 0) {
      itemsToAdd.push('Classic Smash Burger (Rs 1,350)', 'Latte (Rs 950)');
      productIds.push('smash-burger', 'latte');
      totalPrice = 2300;
    }

    const mode = isDelivery ? 'delivery across Lahore' : 'pickup at our MM Alam Road counter';
    const reply = `I've added ${itemsToAdd.join(' and ')} to your bag totaling Rs ${totalPrice.toLocaleString()}. I have queued this for ${mode}. Your bag is ready for checkout!`;
    const audioBase64 = (await synthesizeElevenLabsVoice(reply, voiceId)) || undefined;
    return {
      reply,
      audioBase64,
      action: {
        type: 'ADD_TO_BAG',
        data: {
          items: itemsToAdd,
          productIds,
          totalPrice,
          isDelivery,
        },
      },
    };
  }

  // 5. CAFE INFO / LOCATION / HOURS / FOUNDER
  if (p.includes('hour') || p.includes('time') || p.includes('open') || p.includes('close')) {
    const reply = `All three of our Brewns counters in Gulberg MM Alam Road, DHA Phase 5, and Johar Town are open daily from 7:00 AM to 9:00 PM. Our kitchen and espresso machines run continuously throughout the day!`;
    const audioBase64 = (await synthesizeElevenLabsVoice(reply, voiceId)) || undefined;
    return { reply, audioBase64, action: { type: 'GENERAL' } };
  }

  if (p.includes('location') || p.includes('where') || p.includes('address')) {
    const reply = `We have three counters across Lahore: our flagship on MM Alam Road in Gulberg III, our second house in CCA DHA Phase 5, and our third on Main Boulevard in Johar Town. Which counter would you like to visit?`;
    const audioBase64 = (await synthesizeElevenLabsVoice(reply, voiceId)) || undefined;
    return { reply, audioBase64, action: { type: 'GENERAL' } };
  }

  if (p.includes('hassan') || p.includes('founder') || p.includes('story')) {
    const reply = `Brewns was founded by Hassan Baig, a software engineer from Lahore who wanted specialty coffee without the ceremony or long queues. Hassan engineered our ordering tech and coffee recipes so every cup is pulled at 92 degrees in under 4 minutes!`;
    const audioBase64 = (await synthesizeElevenLabsVoice(reply, voiceId)) || undefined;
    return { reply, audioBase64, action: { type: 'GENERAL' } };
  }

  if (p.includes('hania') || p.includes('ambassador')) {
    const reply = `Hania Aamir is our official Brewns brand ambassador! Her go-to drink is our Iced Matcha Latte and our Cinnamon Roll with extra glaze.`;
    const audioBase64 = (await synthesizeElevenLabsVoice(reply, voiceId)) || undefined;
    return { reply, audioBase64, action: { type: 'GENERAL' } };
  }

  // 6. GENERAL ASSISTANT FALLBACK
  const reply = `At Brewns Coffee House Lahore, we specialize in weekly-roasted Colombian and Ethiopian coffee, smash burgers, and artisanal bakery. Would you like me to take a delivery order, book a table for tonight, or schedule a party?`;
  const audioBase64 = (await synthesizeElevenLabsVoice(reply, voiceId)) || undefined;
  return { reply, audioBase64, action: { type: 'GENERAL' } };
}

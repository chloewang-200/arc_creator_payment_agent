#!/usr/bin/env node

/**
 * Script to delete a creator's ElevenLabs voice
 * Usage: node scripts/delete-creator-voice.js <username>
 * Example: node scripts/delete-creator-voice.js alex-creator
 */

import { createClient } from '@supabase/supabase-js';
import { deleteVoice } from '../lib/elevenlabs.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const username = process.argv[2];

  if (!username) {
    console.error('Usage: node scripts/delete-creator-voice.js <username>');
    console.error('Example: node scripts/delete-creator-voice.js alex-creator');
    process.exit(1);
  }

  try {
    // Get creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, username, name, elevenlabs_voice_id')
      .eq('username', username)
      .single();

    if (creatorError || !creator) {
      console.error(`Creator not found: ${username}`);
      process.exit(1);
    }

    console.log(`Found creator: ${creator.name} (${creator.username})`);
    console.log(`Current voice ID: ${creator.elevenlabs_voice_id || 'None'}`);

    // Delete from ElevenLabs if voice ID exists
    if (creator.elevenlabs_voice_id) {
      try {
        console.log(`Deleting voice from ElevenLabs: ${creator.elevenlabs_voice_id}`);
        await deleteVoice(creator.elevenlabs_voice_id);
        console.log('✅ Voice deleted from ElevenLabs');
      } catch (error) {
        console.warn(`⚠️  Failed to delete from ElevenLabs (may already be deleted):`, error.message);
      }
    } else {
      console.log('No voice ID found, skipping ElevenLabs deletion');
    }

    // Clear from database
    const { error: updateError } = await supabase
      .from('creators')
      .update({
        elevenlabs_voice_id: null,
        voice_sample_url: null,
        voice_sample_duration_seconds: null,
        voice_clone_status: 'missing',
        voice_preview_enabled: false,
      })
      .eq('id', creator.id);

    if (updateError) {
      console.error('Failed to update database:', updateError);
      process.exit(1);
    }

    console.log('✅ Voice cleared from database');
    console.log(`\n${creator.name} can now upload a new voice sample!`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();


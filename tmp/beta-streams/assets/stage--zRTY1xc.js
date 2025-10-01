(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
class DataReader {
  constructor(buffer) {
    this.view = new DataView(buffer);
    this.position = 0;
  }
  readInt8() {
    const value = this.view.getInt8(this.position);
    this.position += 1;
    return value;
  }
  readUint8() {
    const value = this.view.getUint8(this.position);
    this.position += 1;
    return value;
  }
  readUint16() {
    const value = this.view.getUint16(this.position, true);
    this.position += 2;
    return value;
  }
  readInt16() {
    const value = this.view.getInt16(this.position, true);
    this.position += 2;
    return value;
  }
  readUint32() {
    const value = this.view.getUint32(this.position, true);
    this.position += 4;
    return value;
  }
  readInt32() {
    const value = this.view.getInt32(this.position, true);
    this.position += 4;
    return value;
  }
  readFloat32() {
    const value = this.view.getFloat32(this.position, true);
    this.position += 4;
    return value;
  }
  readFloat64() {
    const value = this.view.getFloat64(this.position, true);
    this.position += 8;
    return value;
  }
  readString() {
    const length = this.readUint32();
    if (length > 1) {
      const bytes = new Uint8Array(this.view.buffer, this.position, length);
      this.position += length;
      return new TextDecoder().decode(bytes);
    } else {
      return "";
    }
  }
  readFixedString(length) {
    const bytes = new Uint8Array(this.view.buffer, this.position, length);
    this.position += length;
    return new TextDecoder().decode(bytes);
  }
  readBytes(length) {
    const bytes = new Uint8Array(this.view.buffer, this.position, length);
    this.position += length;
    return bytes;
  }
  skip(bytes) {
    this.position += bytes;
  }
  remaining() {
    return this.view.byteLength - this.position;
  }
}
class StreamDataReader {
  constructor() {
    this.buffer = new Uint8Array(0);
    this.position = 0;
  }
  addData(chunk) {
    const newBuffer = new Uint8Array(this.buffer.length + chunk.length);
    newBuffer.set(this.buffer, 0);
    newBuffer.set(chunk, this.buffer.length);
    this.buffer = newBuffer;
  }
  hasBytes(count) {
    return this.buffer.length - this.position >= count;
  }
  readUint8() {
    if (!this.hasBytes(1)) return null;
    const value = this.buffer[this.position];
    this.position += 1;
    return value;
  }
  readUint16() {
    if (!this.hasBytes(2)) return null;
    const value = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.position, 2).getUint16(0, true);
    this.position += 2;
    return value;
  }
  readUint32() {
    if (!this.hasBytes(4)) return null;
    const value = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.position, 4).getUint32(0, true);
    this.position += 4;
    return value;
  }
  readInt32() {
    if (!this.hasBytes(4)) return null;
    const value = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.position, 4).getInt32(0, true);
    this.position += 4;
    return value;
  }
  readFloat32() {
    if (!this.hasBytes(4)) return null;
    const value = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.position, 4).getFloat32(0, true);
    this.position += 4;
    return value;
  }
  readFloat64() {
    if (!this.hasBytes(8)) return null;
    const value = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.position, 8).getFloat64(0, true);
    this.position += 8;
    return value;
  }
  readString() {
    if (!this.hasBytes(4)) return null;
    const length = this.readUint32();
    if (length === null || !this.hasBytes(length)) return null;
    const strBytes = this.buffer.slice(this.position, this.position + length);
    const str = new TextDecoder().decode(strBytes);
    this.position += length;
    return str;
  }
  readFixedString(length) {
    const strBytes = this.buffer.slice(this.position, this.position + length);
    const str = new TextDecoder().decode(strBytes);
    this.position += length;
    return str;
  }
  remaining() {
    return this.buffer.length - this.position;
  }
  reset() {
    this.position = 0;
  }
}
const CONFIG = {
  /**
   * The maximum number of items allowed in any array read from the file.
   * This is a security measure to prevent errors from malformed files
   * that could lead to excessive memory allocation.
   * @type {number}
   */
  MAX_ARRAY_SIZE: 14096
};
function readArray(reader, parser) {
  const count = reader.readUint32();
  if (count > CONFIG.MAX_ARRAY_SIZE) {
    throw new Error(
      `Array size ${count} exceeds maximum of ${CONFIG.MAX_ARRAY_SIZE} at offset ${reader.position - 4}`
    );
  }
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push(parser(reader));
  }
  return arr;
}
function readStdString(reader) {
  const length = reader.readUint32();
  if (length > 1) {
    const bytes = new Uint8Array(reader.view.buffer, reader.position, length);
    reader.position += length;
    return new TextDecoder().decode(bytes);
  } else {
    return "";
  }
}
function readPlayerCollision(reader) {
  return {
    walking_block_width: reader.readUint32(),
    walking_block_height: reader.readUint32(),
    flying_block_width: reader.readUint32(),
    flying_block_height: reader.readUint32(),
    walking_character_width: reader.readUint32(),
    walking_character_height: reader.readUint32(),
    flying_character_width: reader.readUint32(),
    flying_character_height: reader.readUint32(),
    shot_width: reader.readUint32(),
    shot_height: reader.readUint32(),
    item_width: reader.readUint32(),
    item_height: reader.readUint32(),
    walking_block_position: reader.readUint32(),
    flying_block_position: reader.readUint32(),
    walking_character_position: reader.readUint32(),
    flying_character_position: reader.readUint32(),
    block_display: reader.readUint32(),
    character_display: reader.readUint32(),
    shot_display: reader.readUint32(),
    item_display: reader.readUint32(),
    block_display_color: reader.readUint32(),
    character_display_color: reader.readUint32(),
    shot_display_color: reader.readUint32(),
    item_display_color: reader.readUint32()
  };
}
function readEnemyCollision(reader) {
  return {
    walking_block_width: reader.readUint32(),
    walking_block_height: reader.readUint32(),
    flying_block_width: reader.readUint32(),
    flying_block_height: reader.readUint32(),
    walking_character_width: reader.readUint32(),
    walking_character_height: reader.readUint32(),
    flying_character_width: reader.readUint32(),
    flying_character_height: reader.readUint32(),
    shot_width: reader.readUint32(),
    shot_height: reader.readUint32(),
    walking_block_position: reader.readUint32(),
    flying_block_position: reader.readUint32(),
    walking_character_position: reader.readUint32(),
    flying_character_position: reader.readUint32()
  };
}
function readActorHitbox(reader) {
  return {
    shot_width: reader.readUint32(),
    shot_height: reader.readUint32(),
    character_width: reader.readUint32(),
    character_height: reader.readUint32()
  };
}
function readDeathFade(reader) {
  return {
    list_size: reader.readUint32(),
    auto_disappear_left: reader.readUint32(),
    auto_disappear_right: reader.readUint32(),
    auto_disappear_top: reader.readUint32(),
    auto_disappear_bottom: reader.readUint32(),
    disappear_left_range: reader.readUint32(),
    disappear_right_range: reader.readUint32(),
    disappear_top_range: reader.readUint32(),
    disappear_bottom_range: reader.readUint32(),
    block_end: reader.readUint32()
  };
}
function readStagePalette(reader) {
  let blocks = readArray(reader, readBlock);
  let characters = readArray(reader, readCharacter);
  let items = readArray(reader, readItem);
  return {
    blocks,
    characters,
    items
  };
}
function readStageBlock(reader) {
  return {
    position: reader.readUint32(),
    block: readBlock(reader)
  };
}
function readBlock(reader) {
  return {
    header: reader.readUint32(),
    inherit_palette: reader.readUint8(),
    inherit_palette_data: reader.readUint16(),
    any_of_appearance_conditions_true: reader.readUint8(),
    appearance_condition_once_met_always_true: reader.readUint8(),
    image_number: reader.readUint16(),
    image_type: reader.readUint16(),
    unknown1: reader.readUint8(),
    in_front_of_character: reader.readUint8(),
    transparency: reader.readUint8(),
    mark_display: reader.readUint8(),
    mark_number: reader.readUint8(),
    unknown2: reader.readUint8(),
    block_type: reader.readUint8(),
    invalid_faction: reader.readUint8(),
    action: reader.readUint8(),
    action_parameter: reader.readUint32(),
    acquired_item_palette: reader.readUint8(),
    acquired_item_palette_data_number: reader.readUint16(),
    block_summon_invalid: reader.readUint8(),
    name: (() => {
      const strings_count = reader.readUint32();
      return strings_count > 0 ? readStdString(reader) : (() => {
        throw new Error("Missing block name ??");
      })();
    })(),
    position_x: reader.readInt16(),
    position_y: reader.readInt16(),
    inherited_data_count: reader.readUint32(),
    inherit_block_name: reader.readUint8(),
    inherit_appearance_condition: reader.readUint8(),
    inherit_image: reader.readUint8(),
    inherit_in_front_of_character: reader.readUint8(),
    inherit_transparency: reader.readUint8(),
    inherit_mark: reader.readUint8(),
    inherit_block_type: reader.readUint8(),
    inherit_invalid_faction: reader.readUint8(),
    inherit_action: reader.readUint8(),
    inherit_acquired_item: reader.readUint8(),
    inherit_block_summon: reader.readUint8(),
    display_conditions: readArray(reader, readBasicCondition)
  };
}
function readBasicCondition(reader) {
  return {
    header: reader.readUint32(),
    type: reader.readUint8(),
    right_side_constant: reader.readUint32(),
    right_side_random_lower_limit: reader.readUint32(),
    right_side_random_upper_limit: reader.readUint32(),
    left_side_status_target: reader.readUint8(),
    left_side_status_number: reader.readUint8(),
    left_side_type: reader.readUint8(),
    left_side_common_variable_or_stage_variable: reader.readUint8(),
    left_side_variable_number: reader.readUint16(),
    left_side_flow_variable_number: reader.readUint8(),
    right_side_type: reader.readUint8(),
    right_side_status_target: reader.readUint8(),
    right_side_status_number: reader.readUint8(),
    right_side_common_variable_or_stage_variable: reader.readUint8(),
    right_side_variable_number: reader.readUint16(),
    right_side_flow_variable_number: reader.readUint8(),
    how_to_compare: reader.readUint8(),
    specify_in_percent: reader.readUint8(),
    left_side_coordinate_type: reader.readUint8(),
    right_side_coordinate_type: reader.readUint8(),
    left_side_gigantic_character_coordinate_position: reader.readUint8(),
    right_side_gigantic_character_coordinate_position: reader.readUint8(),
    unk1: reader.readUint8(),
    unk2: reader.readUint8(),
    unk3: reader.readUint8(),
    unk4: reader.readUint8(),
    unk5: reader.readUint8()
  };
}
function readCharacter(reader) {
  return {
    header: reader.readUint32(),
    inherit_palette: reader.readUint8(),
    inherit_palette_data_number: reader.readUint16(),
    any_of_appearance_conditions_true: reader.readUint8(),
    appearance_condition_once_met_always_true: reader.readUint8(),
    facing_right: reader.readUint8(),
    number_of_doubles: reader.readUint8(),
    appearance_position_offset_x_bl: reader.readUint16(),
    appearance_position_offset_x_dot: reader.readUint16(),
    appearance_position_offset_y_bl: reader.readUint16(),
    appearance_position_offset_y_dot: reader.readUint16(),
    appearance_position_offset_x_flip_if_facing_right: reader.readUint8(),
    appearance_position_offset_y_flip_if_facing_right: reader.readUint8(),
    image_number: reader.readUint16(),
    image_type: reader.readUint8(),
    image_offset: reader.readUint16(),
    animation_set: reader.readUint16(),
    z_coordinate: reader.readUint8(),
    transparency: reader.readUint8(),
    initial_character_effect: reader.readUint16(),
    initial_character_effect_execution_type: reader.readUint8(),
    initial_character_effect_loop_execution: reader.readUint8(),
    character_effect_on_death: reader.readUint16(),
    character_effect_on_death_execution_type: reader.readUint8(),
    mark_display: reader.readUint8(),
    mark_number: reader.readUint16(),
    operation: reader.readUint16(),
    faction: reader.readUint8(),
    character_id: reader.readUint8(),
    flying: reader.readUint8(),
    direction_fixed: reader.readUint8(),
    invincible: reader.readUint8(),
    invincible_effect: reader.readUint8(),
    block: reader.readUint8(),
    gigantic: reader.readUint8(),
    synchronize_with_auto_scroll: reader.readUint8(),
    line_of_sight: reader.readUint8(),
    line_of_sight_range: reader.readUint8(),
    hp: reader.readUint32(),
    sp: reader.readUint32(),
    stopping_ease_during_inertial_movement: reader.readUint16(),
    body_hit_detection_range: reader.readUint8(),
    body_hit_power: reader.readUint32(),
    body_hit_impact: reader.readUint8(),
    body_hit_effect: reader.readUint16(),
    defense: reader.readUint32(),
    impact_resistance: reader.readUint8(),
    score: reader.readUint32(),
    holds_item_at_same_position: reader.readUint8(),
    has_group: reader.readUint8(),
    group_number: reader.readUint16(),
    action_condition_range: reader.readUint8(),
    action_condition_judgment_type: reader.readUint8(),
    character_name: (() => {
      const strings_count = reader.readUint32();
      if (strings_count > 0) {
        const name = readStdString(reader);
        for (let i = 1; i < strings_count; i++) {
          reader.readStdString();
        }
        return name;
      } else {
        for (let i = 1; i < strings_count; i++) {
          reader.readStdString();
        }
        return "";
      }
    })(),
    position_x: reader.readUint16(),
    position_y: reader.readUint16(),
    some_count: reader.readInt32(),
    inherited_data_count: reader.readUint32(),
    inherit_character_name: reader.readUint8(),
    inherit_operation: reader.readUint8(),
    inherit_faction: reader.readUint8(),
    inherit_character_id: reader.readUint8(),
    inherit_appearance_condition: reader.readUint8(),
    inherit_facing_right: reader.readUint8(),
    inherit_number_of_doubles: reader.readUint8(),
    inherit_initial_position_offset_x: reader.readUint8(),
    inherit_initial_position_offset_y: reader.readUint8(),
    inherit_image: reader.readUint8(),
    inherit_animation_set: reader.readUint8(),
    inherit_z_coordinate: reader.readUint8(),
    inherit_transparency: reader.readUint8(),
    inherit_initial_character_effect: reader.readUint8(),
    inherit_character_effect_on_death: reader.readUint8(),
    inherit_mark: reader.readUint8(),
    inherit_direction_fixed: reader.readUint8(),
    inherit_flying: reader.readUint8(),
    inherit_invincible: reader.readUint8(),
    inherit_block: reader.readUint8(),
    inherit_gigantic: reader.readUint8(),
    inherit_synchronize_with_auto_scroll: reader.readUint8(),
    inherit_line_of_sight: reader.readUint8(),
    inherit_hp: reader.readUint8(),
    inherit_sp: reader.readUint8(),
    inherit_body_hit_detection_range: reader.readUint8(),
    inherit_body_hit_power: reader.readUint8(),
    inherit_body_hit_impact: reader.readUint8(),
    inherit_body_hit_effect: reader.readUint8(),
    inherit_defense: reader.readUint8(),
    inherit_impact_resistance: reader.readUint8(),
    inherit_stopping_ease_during_inertial_movement: reader.readUint8(),
    inherit_action_condition: reader.readUint8(),
    inherit_group: reader.readUint8(),
    inherit_score: reader.readUint8(),
    inherit_holds_item_at_same_position: reader.readUint8(),
    inherit_action: reader.readUint8(),
    conditions: readArray(reader, readBasicCondition),
    flows: readArray(reader, readFlow)
  };
}
function readFlow(reader) {
  const header = reader.readUint32();
  if (header !== 10) {
    throw new Error(
      `Invalid Flow header: expected 10, got ${header} at offset ${reader.position - 4}`
    );
  }
  return {
    header,
    id: reader.readUint8(),
    group: reader.readUint8(),
    test_play_only: reader.readUint8(),
    basic_condition_judgment_type: reader.readUint8(),
    basic_condition_once_met_always_met: reader.readUint8(),
    timing: reader.readUint8(),
    target_character_involved_in_timing: reader.readUint8(),
    target_number_of_character_involved_in_timing: reader.readUint8(),
    ease_of_input_with_multiple_key_conditions: reader.readUint8(),
    allow_continuous_execution_by_holding_key: reader.readUint8(),
    memo_length: reader.readUint32(),
    memo: readStdString(reader),
    conditions: readArray(reader, readBasicCondition),
    key_conditions: readArray(reader, readKeyCondition),
    commands: readArray(reader, readCommand)
  };
}
function readKeyCondition(reader) {
  return {
    header: reader.readUint32(),
    right_and_left_to_front_and_back: reader.readUint8(),
    minimum_input_time: reader.readUint16(),
    maximum_input_time: reader.readUint16(),
    input_time_1_to_infinity: reader.readUint8(),
    judgment_type: reader.readUint8(),
    unknown: reader.readUint32(),
    number_of_key_data: reader.readUint32(),
    direction_key_neutral: reader.readUint8(),
    left_key: reader.readUint8(),
    right_key: reader.readUint8(),
    up_key: reader.readUint8(),
    down_key: reader.readUint8(),
    up_left_key: reader.readUint8(),
    down_left_key: reader.readUint8(),
    up_right_key: reader.readUint8(),
    down_right_key: reader.readUint8(),
    any_direction_key: reader.readUint8(),
    action_key_neutral: reader.readUint8(),
    z_key: reader.readUint8(),
    x_key: reader.readUint8(),
    c_key: reader.readUint8(),
    v_key: reader.readUint8(),
    a_key: reader.readUint8(),
    s_key: reader.readUint8(),
    d_key: reader.readUint8(),
    f_key: reader.readUint8()
  };
}
function readItem(reader) {
  return {
    header: reader.readUint32(),
    inherit_palette: reader.readUint8(),
    inherit_palette_data_number: reader.readUint16(),
    any_of_appearance_conditions_true: reader.readUint8(),
    appearance_condition_once_met_always_true: reader.readUint8(),
    appearance_position_offset_x_dot: reader.readUint16(),
    appearance_position_offset_y_dot: reader.readUint16(),
    image_number: reader.readUint16(),
    image_type: reader.readUint8(),
    frame: reader.readUint16(),
    z_coordinate: reader.readUint8(),
    transparency: reader.readUint8(),
    mark_display: reader.readUint8(),
    mark_number: reader.readUint16(),
    display_above_head_on_acquisition: reader.readUint8(),
    acquisition_type: reader.readUint8(),
    gigantic: reader.readUint8(),
    sound_effect: reader.readUint16(),
    item_name_length: reader.readUint32(),
    // always 1
    item_name: reader.readString(),
    position_x: reader.readUint16(),
    position_y: reader.readUint16(),
    number_of_inherited_data: reader.readUint32(),
    inherit_item_name: reader.readUint8(),
    inherit_appearance_condition: reader.readUint8(),
    inherit_initial_position_offset_x: reader.readUint8(),
    inherit_initial_position_offset_y: reader.readUint8(),
    inherit_image: reader.readUint8(),
    inherit_z_coordinate: reader.readUint8(),
    inherit_transparency: reader.readUint8(),
    inherit_mark: reader.readUint8(),
    inherit_gigantic: reader.readUint8(),
    inherit_acquisition_type: reader.readUint8(),
    inherit_display_above_head_on_acquisition: reader.readUint8(),
    inherit_sound_effect: reader.readUint8(),
    inherit_effect: reader.readUint8(),
    conditions: readArray(reader, readBasicCondition),
    item_effects: readArray(reader, readItemEffect)
  };
}
function readItemEffect(reader) {
  const effect = {
    header: reader.readUint32(),
    unk1: reader.readInt8(),
    type: reader.readUint8()
  };
  if (effect.header !== 8) {
    throw new Error(
      `Invalid item effect header: expected 8, got ${effect.header} at offset ${reader.position - 6}`
    );
  }
  switch (effect.type) {
    case 1:
      effect.details = parseFlowChangeDetails(reader);
      break;
    case 2:
      effect.details = parseStageClearDetails(reader);
      break;
    case 3:
      effect.details = parseGameWaitDetails(reader);
      break;
    case 4:
      effect.details = parseMessageDetails(reader);
      break;
    case 5:
      effect.details = parseWarpDetails(reader);
      break;
    case 7:
      effect.details = parseStatusOperationDetails(reader);
      break;
    case 8:
      effect.details = parseStatusOperation2Details(reader);
      break;
    case 9:
      effect.details = parseDisappearanceDetails(reader);
      break;
    case 10:
      effect.details = parseItemAcquisitionDetails(reader);
      break;
    case 11:
      effect.details = parseGraphicChangeDetails(reader);
      break;
    case 12:
      effect.details = parseBasicAnimationSetChangeDetails(reader);
      break;
    case 13:
      effect.details = parseAnimationExecutionDetails(reader);
      break;
    case 14:
      effect.details = parseEffectExecutionDetails(reader);
      break;
    case 15:
      effect.details = parseCharacterEffectExecutionDetails(reader);
      break;
    case 16:
      effect.details = parseScreenEffectExecutionDetails(reader);
      break;
    case 17:
      effect.details = parsePictureDisplayDetails(reader);
      break;
    case 19:
      effect.details = parseBackgroundChangeDetails(reader);
      break;
    case 20:
      effect.details = parseSoundEffectPlaybackDetails(reader);
      break;
    case 21:
      effect.details = parseBGMPlaybackDetails(reader);
      break;
    case 22:
      effect.details = parseCodeExecutionDetails(reader);
      break;
    case 23:
      effect.details = parseArrangementDetails(reader);
      break;
    case 24:
      effect.details = parseLoopDetails(reader);
      break;
    default:
      throw new Error(
        `Unknown item effect type: ${effect.type} at offset ${reader.position - 1}`
      );
  }
  return effect;
}
function parseFlowChangeDetails(reader) {
  const data = {
    bytes1_30: reader.readBytes(30)
  };
  data.flows = readArray(reader, readFlow);
  Object.assign(data, {
    bytes69_72: reader.readBytes(4),
    operation: reader.readUint32(),
    bytes77_80: reader.readBytes(4)
  });
  return data;
}
function parseStageClearDetails(reader) {
  return {
    bytes1_14: reader.readBytes(14),
    path: readStdString(reader),
    bytes19_38: reader.readBytes(20),
    stage_transition: reader.readUint32(),
    number: reader.readUint32(),
    change_world_map_position: reader.readUint32(),
    world_map_position_x: reader.readUint32(),
    world_map_position_y: reader.readUint32(),
    change_initial_position: reader.readUint32(),
    initial_position_x: reader.readUint32(),
    initial_position_y: reader.readUint32(),
    initial_position_main_character_direction: reader.readUint32(),
    execute_autosave: reader.readUint32(),
    add_clear_text_to_replay: reader.readUint32()
  };
}
function parseGameWaitDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes6_38: reader.readBytes(33),
    game_wait_execution_time: reader.readUint32()
  };
}
function parseMessageDetails(reader) {
  return {
    bytes1_14: reader.readBytes(14),
    message: readStdString(reader),
    bytes19_38: reader.readBytes(20),
    display_position_specification_method: reader.readUint32(),
    coordinate_x: reader.readUint32(),
    coordinate_y: reader.readUint32(),
    display_position_offset_x: reader.readUint32(),
    display_position_offset_y: reader.readUint32(),
    auto_adjust_to_not_go_off_screen: reader.readUint32(),
    display_time_specification_method: reader.readUint32(),
    display_time: reader.readUint32(),
    pause: reader.readUint32(),
    display_variables: reader.readUint32(),
    follow_screen: reader.readUint32(),
    auto_update: reader.readUint32(),
    message_id_present: reader.readUint32(),
    message_id: reader.readUint32(),
    window_display: reader.readUint32(),
    message_clear: reader.readUint32(),
    update_interval: reader.readUint32(),
    instant_display: reader.readUint32(),
    coordinate_unit: reader.readUint32(),
    set_options: reader.readUint32(),
    assign_return_value_to_flow_variable: reader.readUint32()
  };
}
function parseWarpDetails(reader) {
  return {
    bytes1_26: reader.readBytes(26),
    setting_type: reader.readUint8(),
    direction: reader.readUint8(),
    bytes29_33: reader.readBytes(5),
    target_x_present: reader.readUint8(),
    target_y_present: reader.readUint8(),
    target_x_bl: reader.readUint16(),
    target_y_bl: reader.readUint16(),
    target_x_dot: reader.readUint16(),
    target_y_dot: reader.readUint16(),
    target_type: reader.readUint8(),
    target_unit: reader.readUint8(),
    gigantic_character_coordinate_position: reader.readUint8(),
    bytes47_49: reader.readBytes(3),
    target_x_flip_if_facing_right: reader.readUint8(),
    target_y_flip_if_facing_right: reader.readUint8(),
    bytes52_59: reader.readBytes(8),
    distance: reader.readUint16(),
    distance_double: reader.readUint16(),
    bytes64_101: reader.readBytes(38),
    assign_return_value_to_flow: reader.readUint32()
  };
}
function parseStatusOperationDetails(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    operation_target_type: reader.readUint8(),
    bytes40_43: reader.readBytes(4),
    operation_target_variable_type: reader.readUint8(),
    bytes45_46: reader.readBytes(2),
    operation_target_variable_number: reader.readUint16(),
    bytes49_52: reader.readBytes(4),
    operation_target_target: reader.readUint8(),
    bytes54_56: reader.readBytes(3),
    operation_target_status: reader.readUint8(),
    byte58: reader.readBytes(1),
    operation_target_flow_variable_number: reader.readUint8(),
    bytes60_62: reader.readBytes(3),
    operator_type: reader.readUint8(),
    bytes64_66: reader.readBytes(3),
    calculation_content_type: reader.readUint32(),
    calculation_content_constant: reader.readUint32(),
    calculation_content_random_lower_limit: reader.readUint32(),
    calculation_content_random_upper_limit: reader.readUint32(),
    calculation_content_variable_type: reader.readUint32(),
    calculation_content_variable_number: reader.readUint32(),
    calculation_content_target: reader.readUint32(),
    calculation_content_status: reader.readUint32(),
    calculation_content_flow_variable_number: reader.readUint32(),
    bytes103_138: reader.readBytes(36)
  };
}
function parseStatusOperation2Details(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    target: reader.readUint32(),
    status: reader.readUint32(),
    on: reader.readUint32(),
    bytes51_62: reader.readBytes(12)
  };
}
function parseDisappearanceDetails(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    target: reader.readUint32(),
    faction: reader.readUint32(),
    range: reader.readUint32(),
    assign_return_value_to_flow_variable: reader.readUint32()
  };
}
function parseItemAcquisitionDetails(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    palette_type: reader.readUint32(),
    palette_data_number: reader.readUint32()
  };
}
function parseGraphicChangeDetails(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    image_type: reader.readUint32(),
    image_number: reader.readUint32(),
    offset: reader.readUint32()
  };
}
function parseBasicAnimationSetChangeDetails(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    animation_set: reader.readUint32()
  };
}
function parseAnimationExecutionDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes: reader.readBytes(41)
  };
}
function parseEffectExecutionDetails(reader) {
  return { bytes1_38: reader.readBytes(38), bytes: reader.readBytes(40) };
}
function parseCharacterEffectExecutionDetails(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    effect: reader.readUint32(),
    execution_type: reader.readUint32(),
    loop_execution: reader.readUint32()
  };
}
function parseScreenEffectExecutionDetails(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    effect: reader.readUint32(),
    execution_type: reader.readUint32(),
    loop_execution: reader.readUint32()
  };
}
function parsePictureDisplayDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes: reader.readBytes(113)
  };
}
function parseBackgroundChangeDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes: reader.readBytes(41)
  };
}
function parseSoundEffectPlaybackDetails(reader) {
  return {
    bytes1_7: reader.readBytes(7),
    play_if_outside_screen: reader.readUint8(),
    bytes9_38: reader.readBytes(30),
    sound_effect: reader.readUint32()
  };
}
function parseBGMPlaybackDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes: reader.readBytes(41)
  };
}
function parseCodeExecutionDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes6_14: reader.readBytes(9),
    code: readStdString(reader),
    bytes19_38: reader.readBytes(20)
  };
}
function parseArrangementDetails(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    command: reader.readUint32(),
    parameter: reader.readUint32(),
    operator_type: reader.readUint32(),
    variable_type: reader.readUint32(),
    variable_number: reader.readUint32()
  };
}
function parseLoopDetails(reader) {
  return {
    bytes1_38: reader.readBytes(38),
    repeat_count: reader.readUint32(),
    command_count: reader.readUint32()
  };
}
function readCommand(reader) {
  const command = {
    header: reader.readUint32(),
    unk1: reader.readUint8(),
    type: reader.readUint8()
  };
  if (command.header !== 8) {
    throw new Error(
      `Invalid command header: expected 8, got ${command.header} at offset ${reader.position - 6}`
    );
  }
  switch (command.type) {
    case 1:
      command.details = parseWaitDetails(reader);
      break;
    case 2:
      command.details = parseLinearMovementDetails(reader);
      break;
    case 3:
      command.details = parseGroundMovementDetails(reader);
      break;
    case 4:
      command.details = parseCircularMovementDetails(reader);
      break;
    case 5:
      command.details = parseChargeMovementDetails(reader);
      break;
    case 6:
      command.details = parseGuidedMovementDetails(reader);
      break;
    case 7:
      command.details = parseScreenOutsideAvoidanceMovementDetails(reader);
      break;
    case 8:
      command.details = parseMovementInvalidationDetails(reader);
      break;
    case 9:
      command.details = parseDirectionChangeDetails(reader);
      break;
    case 10:
      command.details = parseJumpDetails(reader);
      break;
    case 11:
      command.details = parseShotDetails(reader);
      break;
    case 12:
      command.details = parseSwordDetails(reader);
      break;
    case 13:
      command.details = parseBlockSummonDetails(reader);
      break;
    case 14:
      command.details = parseCharacterSummonDetails(reader);
      break;
    case 15:
      command.details = parseItemSummonDetails(reader);
      break;
    case 16:
      command.details = parseFlowOperationDetails(reader);
      break;
    case 17:
      command.details = parseStageClearDetails(reader);
      break;
    case 18:
      command.details = parseGameWaitDetails(reader);
      break;
    case 19:
      command.details = parseMessageDetails(reader);
      break;
    case 20:
      command.details = parseWarpDetails(reader);
      break;
    case 21:
      command.details = parseTargetSettingDetails(reader);
      break;
    case 22:
      command.details = parseStatusOperationDetails(reader);
      break;
    case 23:
      command.details = parseStatusOperation2Details(reader);
      break;
    case 24:
      command.details = parseDisappearanceDetails(reader);
      break;
    case 25:
      command.details = parseItemAcquisitionDetails(reader);
      break;
    case 26:
      command.details = parseGraphicChangeDetails(reader);
      break;
    case 27:
      command.details = parseBasicAnimationSetChangeDetails(reader);
      break;
    case 28:
      command.details = parseAnimationExecutionDetails(reader);
      break;
    case 29:
      command.details = parseEffectExecutionDetails(reader);
      break;
    case 30:
      command.details = parseCharacterEffectExecutionDetails(reader);
      break;
    case 31:
      command.details = parseScreenEffectExecutionDetails(reader);
      break;
    case 32:
      command.details = parsePictureDisplayDetails(reader);
      break;
    case 34:
      command.details = parseBackgroundChangeDetails(reader);
      break;
    case 35:
      command.details = parseSoundEffectPlaybackDetails(reader);
      break;
    case 36:
      command.details = parseBGMPlaybackDetails(reader);
      break;
    case 37:
      command.details = parseCodeExecutionDetails(reader);
      break;
    case 38:
      command.details = parseArrangementDetails(reader);
      break;
    case 39:
      command.details = parseLoopDetails(reader);
      break;
    default:
      throw new Error(
        `Unknown command type: ${command.type} at offset ${reader.position - 1}`
      );
  }
  return command;
}
function parseWaitDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes: reader.readBytes(33)
  };
}
function parseLinearMovementDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes6_8: reader.readBytes(3),
    animation_and_other_type: reader.readUint16(),
    bytes11_26: reader.readBytes(16),
    movement_direction_setting_type: reader.readUint8(),
    movement_direction_direction: reader.readUint8(),
    movement_direction_angle: reader.readUint16(),
    movement_direction_angle_double: reader.readUint16(),
    movement_direction_angle_reverse_rotation_if_facing_right: reader.readUint8(),
    movement_direction_target_x_present: reader.readUint8(),
    movement_direction_target_y_present: reader.readUint8(),
    movement_direction_target_x: reader.readUint16(),
    movement_direction_target_y: reader.readUint16(),
    movement_direction_target_x_dot: reader.readUint16(),
    movement_direction_target_y_dot: reader.readUint16(),
    movement_direction_target_type: reader.readUint8(),
    movement_direction_target_coordinate_unit: reader.readUint8(),
    byte46: reader.readBytes(1),
    movement_direction_execute_until_target_coordinate_reached: reader.readUint8(),
    movement_direction_invalidate_horizontal_movement: reader.readUint8(),
    movement_direction_invalidate_vertical_movement: reader.readUint8(),
    movement_direction_target_x_flip_if_facing_right: reader.readUint8(),
    movement_direction_target_y_flip_if_facing_right: reader.readUint8(),
    movement_direction_reverse_speed_if_direction_changes: reader.readUint8(),
    movement_direction_prevent_blur: reader.readUint8(),
    movement_direction_dont_change_character_direction: reader.readUint8(),
    time_speed_distance_setting_type: reader.readUint8(),
    time_speed_distance_speed: reader.readUint16(),
    time_speed_distance_speed_double: reader.readUint16(),
    time_speed_distance_distance: reader.readUint16(),
    time_speed_distance_distance_double: reader.readUint16(),
    time_speed_distance_distance_unit: reader.readUint8(),
    bytes65_68: reader.readBytes(4),
    inertia_present: reader.readUint8(),
    inertia_max_speed: reader.readUint16(),
    inertia_speed_correction_on_direction_change: reader.readFloat64(),
    animation_type: reader.readUint8(),
    bytes81_101: reader.readBytes(21)
  };
}
function parseGenericMovementDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes6_101: reader.readBytes(96)
  };
}
const parseGroundMovementDetails = parseGenericMovementDetails;
const parseCircularMovementDetails = parseGenericMovementDetails;
const parseChargeMovementDetails = parseGenericMovementDetails;
const parseGuidedMovementDetails = parseGenericMovementDetails;
const parseScreenOutsideAvoidanceMovementDetails = parseGenericMovementDetails;
const parseMovementInvalidationDetails = parseGenericMovementDetails;
function parseDirectionChangeDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    bytes6_42: reader.readBytes(37)
  };
}
function parseJumpDetails(reader) {
  return {
    bytes1_5: reader.readBytes(5),
    sound_effect: reader.readUint16(),
    play_if_outside_screen: reader.readUint8(),
    animation: reader.readUint16(),
    bytes11_38: reader.readBytes(28),
    jump_type: reader.readUint32(),
    max_jump_inertial_movement_speed: reader.readUint32(),
    max_jump_height: reader.readUint32(),
    min_jump_inertial_movement_speed: reader.readUint32(),
    min_jump_height: reader.readUint32()
  };
}
function parseShotDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    sound_effect: reader.readUint16(),
    play_if_outside_screen: reader.readUint8(),
    animation: reader.readUint16(),
    bytes11_30: reader.readBytes(20),
    number_of_shots_fired: reader.readUint8(),
    formation: reader.readUint8(),
    firing_parameter1: reader.readUint16(),
    firing_parameter2: reader.readUint16(),
    firing_parameter3: reader.readUint16(),
    target: reader.readUint8(),
    direction: reader.readUint8(),
    set_angle_to_target: reader.readUint8(),
    firing_target: reader.readUint8(),
    angle_offset: reader.readUint16(),
    angle_offset_double: reader.readUint16(),
    angle_offset_reverse_rotation_if_facing_right: reader.readUint8(),
    angle_dispersion: reader.readUint16(),
    change_firing_position_according_to_angle: reader.readUint8(),
    number_of_doubles: reader.readUint8(),
    firing_position_offset_x: reader.readUint16(),
    firing_position_offset_x_double: reader.readUint16(),
    firing_position_offset_y: reader.readUint16(),
    firing_position_offset_y_double: reader.readUint16(),
    firing_position_offset_x_flip_if_facing_right: reader.readUint8(),
    firing_position_offset_y_flip_if_facing_right: reader.readUint8(),
    graphic: reader.readUint16(),
    z_coordinate: reader.readUint8(),
    transparency: reader.readUint8(),
    faction_same_as_user: reader.readUint8(),
    faction: reader.readUint16(),
    gigantic: reader.readUint16(),
    movement_type: reader.readUint8(),
    movement_type_parameter1: reader.readUint16(),
    movement_type_parameter2: reader.readUint16(),
    movement_type_parameter3: reader.readUint16(),
    movement_target: reader.readUint8(),
    synchronize_with_auto_scroll: reader.readUint8(),
    speed: reader.readUint16(),
    speed_double: reader.readUint16(),
    acceleration_enabled: reader.readUint8(),
    acceleration: reader.readUint16(),
    acceleration_double: reader.readUint16(),
    flight_distance: reader.readUint16(),
    flight_distance_valid: reader.readUint8(),
    flight_distance_double: reader.readUint16(),
    flight_distance_does_not_disappear_at_end: reader.readUint8(),
    disappearance_time_valid: reader.readUint8(),
    disappearance_time: reader.readUint16(),
    disappearance_time_double: reader.readUint16(),
    penetrate_blocks: reader.readUint8(),
    penetrate_actors: reader.readUint8(),
    penetrate_block_actors: reader.readUint8(),
    disappear_on_hitting_shot: reader.readUint8(),
    value_for_disappearing_on_hitting_shot: reader.readUint8(),
    power: reader.readUint32(),
    bytes109_110: reader.readBytes(2),
    impact: reader.readUint8(),
    effect: reader.readUint16(),
    acquired_item_palette_type: reader.readUint8(),
    acquired_item_palette_number: reader.readUint16(),
    bytes117_125: reader.readBytes(9),
    attack: reader.readUint8(),
    attack_id: reader.readUint8(),
    bytes128_143: reader.readBytes(16)
  };
}
function parseSwordDetails(reader) {
  return {
    execution_time: reader.readUint32(),
    parallel_execution: reader.readUint8(),
    sound_effect: reader.readUint16(),
    play_if_outside_screen: reader.readUint8(),
    animation: reader.readUint16(),
    bytes11_63: reader.readBytes(53),
    z_coordinate: reader.readUint8(),
    transparency: reader.readUint8(),
    faction_same_as_user: reader.readUint8(),
    faction: reader.readUint16(),
    gigantic: reader.readUint16(),
    sword_type: reader.readUint32(),
    bytes75_104: reader.readBytes(30),
    power: reader.readUint32(),
    bytes109_110: reader.readBytes(2),
    impact: reader.readUint8(),
    effect: reader.readUint16(),
    acquired_item_palette_type: reader.readUint8(),
    acquired_item_palette_number: reader.readUint16(),
    bytes117_125: reader.readBytes(9),
    attack: reader.readUint8(),
    attack_id: reader.readUint8(),
    bytes128_143: reader.readBytes(16)
  };
}
function parseBlockSummonDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    sound_effect: reader.readUint16(),
    play_sound_effect_if_outside_screen: reader.readUint8(),
    animation: reader.readUint8(),
    bytes10_30: reader.readBytes(21),
    count: reader.readUint8(),
    formation: reader.readUint8(),
    interval: reader.readUint16(),
    number_of_columns: reader.readUint16(),
    column_interval: reader.readUint16(),
    target: reader.readUint8(),
    direction: reader.readUint8(),
    byte41: reader.readBytes(1),
    target2: reader.readUint8(),
    bytes43_51: reader.readBytes(9),
    summon_position_offset_x: reader.readUint32(),
    summon_position_offset_y: reader.readUint32(),
    summon_position_offset_x_flip: reader.readUint8(),
    summon_position_offset_y_flip: reader.readUint8(),
    bytes62_66: reader.readBytes(5),
    faction: reader.readUint8(),
    bytes68_88: reader.readBytes(21),
    existence_time: reader.readUint16(),
    existence_time_present: reader.readUint8(),
    bytes92_119: reader.readBytes(28),
    palette_type: reader.readUint8(),
    palette_data_number: reader.readUint16(),
    faction_specification_method: reader.readUint8(),
    set_acquired_score_to_0: reader.readUint8(),
    direction_flip: reader.readUint8(),
    attack: reader.readUint8(),
    attack_flow: reader.readUint8(),
    bytes128_143: reader.readBytes(16),
    return_value_to_flow_variable: reader.readUint8(),
    bytes145_147: reader.readBytes(3)
  };
}
function parseCharacterSummonDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    sound_effect: reader.readUint16(),
    play_sound_effect_if_outside_screen: reader.readUint8(),
    animation: reader.readUint8(),
    bytes10_30: reader.readBytes(21),
    count: reader.readUint8(),
    formation: reader.readUint8(),
    interval: reader.readUint16(),
    number_of_columns: reader.readUint16(),
    column_interval: reader.readUint16(),
    target: reader.readUint8(),
    direction: reader.readUint8(),
    byte41: reader.readBytes(1),
    target2: reader.readUint8(),
    bytes43_51: reader.readBytes(9),
    summon_position_offset_x: reader.readUint32(),
    summon_position_offset_y: reader.readUint32(),
    summon_position_offset_x_flip: reader.readUint8(),
    summon_position_offset_y_flip: reader.readUint8(),
    bytes62_66: reader.readBytes(5),
    faction: reader.readUint8(),
    bytes68_88: reader.readBytes(21),
    existence_time: reader.readUint16(),
    existence_time_present: reader.readUint8(),
    bytes92_119: reader.readBytes(28),
    palette_type: reader.readUint8(),
    palette_data_number: reader.readUint16(),
    faction_specification_method: reader.readUint8(),
    set_acquired_score_to_0: reader.readUint8(),
    direction_flip: reader.readUint8(),
    attack: reader.readUint8(),
    attack_flow: reader.readUint8(),
    bytes128_143: reader.readBytes(16),
    return_value_to_flow_variable: reader.readUint8(),
    bytes145_147: reader.readBytes(3)
  };
}
function parseItemSummonDetails(reader) {
  return {
    execution_time: reader.readUint16(),
    execution_time_double: reader.readUint16(),
    parallel_execution: reader.readUint8(),
    sound_effect: reader.readUint16(),
    play_sound_effect_if_outside_screen: reader.readUint8(),
    animation: reader.readUint8(),
    bytes10_30: reader.readBytes(21),
    count: reader.readUint8(),
    formation: reader.readUint8(),
    interval: reader.readUint16(),
    number_of_columns: reader.readUint16(),
    column_interval: reader.readUint16(),
    target: reader.readUint8(),
    direction: reader.readUint8(),
    byte41: reader.readUint8(),
    target2: reader.readUint8(),
    bytes43_51: reader.readBytes(9),
    summon_position_offset_x: reader.readUint32(),
    summon_position_offset_y: reader.readUint32(),
    summon_position_offset_x_flip: reader.readUint8(),
    summon_position_offset_y_flip: reader.readUint8(),
    bytes62_66: reader.readBytes(5),
    faction: reader.readUint8(),
    bytes68_88: reader.readBytes(21),
    existence_time: reader.readUint16(),
    existence_time_present: reader.readUint8(),
    bytes92_119: reader.readBytes(28),
    palette_type: reader.readUint8(),
    palette_data_number: reader.readUint16(),
    faction_specification_method: reader.readUint8(),
    set_acquired_score_to_0: reader.readUint8(),
    direction_flip: reader.readUint8(),
    attack: reader.readUint8(),
    attack_flow: reader.readUint8(),
    bytes128_143: reader.readBytes(16)
  };
}
function parseFlowOperationDetails(reader) {
  const data = {
    bytes1_34: reader.readBytes(34),
    condition_present: reader.readUint8(),
    judgment_type: reader.readUint8(),
    bytes37_40: reader.readBytes(4)
  };
  data.conditions = readArray(reader, readBasicCondition);
  data.bytes45_52 = reader.readBytes(8);
  data.operation = reader.readUint32();
  data.target_flow = reader.readUint32();
  data.id = reader.readUint32();
  data.target_character = reader.readUint32();
  data.assign_return_value_to_flow_variable = reader.readUint32();
  return data;
}
function parseTargetSettingDetails(reader) {
  return { bytes1_38: reader.readBytes(38), bytes39_106: reader.readBytes(68) };
}
function readStageCharacter(reader) {
  return {
    position: reader.readUint32(),
    character: readCharacter(reader)
  };
}
function readStageItem(reader) {
  return {
    position: reader.readUint32(),
    item: readItem(reader)
  };
}
function readBackground(reader) {
  return {
    start: reader.readUint32(),
    display_from_start: reader.readUint32(),
    specified_by_color: reader.readUint32(),
    color_number: reader.readUint32(),
    display_in_front_of_character: reader.readUint32(),
    horizontal_scroll_speed: reader.readFloat64(),
    vertical_scroll_speed: reader.readFloat64(),
    horizontal_auto_scroll: reader.readUint32(),
    vertical_auto_scroll: reader.readUint32(),
    horizontal_auto_scroll_speed: reader.readFloat64(),
    vertical_auto_scroll_speed: reader.readFloat64(),
    bytes61_80: reader.readBytes(20),
    image_path: readStdString(reader)
  };
}
function readStageVar(reader) {
  return {
    some_count: reader.readUint32(),
    some_count_too: reader.readUint32(),
    variable_name: readStdString(reader)
  };
}
function parseStagePaletteFile(reader) {
  const magic = reader.readUint32();
  if (magic !== 1020) {
    throw new Error(`Invalid STG4 magic: ${magic}, expected 1020`);
  }
  return {
    some_count: reader.readUint32(),
    // 99 - std::vector<int>
    item_width: reader.readUint32(),
    chunk_width: reader.readUint32(),
    // 32
    chunk_pow: reader.readUint32(),
    // 5
    height: reader.readUint32(),
    enable_horizontal_scroll_minimum: reader.readUint32(),
    enable_horizontal_scroll_maximum: reader.readUint32(),
    enable_vertical_scroll_minimum: reader.readUint32(),
    // top left
    enable_vertical_scroll_maximum: reader.readUint32(),
    // bottom
    horizontal_scroll_minimum_value: reader.readUint32(),
    horizontal_scroll_maximum_value: reader.readUint32(),
    vertical_scroll_minimum_value: reader.readUint32(),
    vertical_scroll_maximum_value: reader.readUint32(),
    // Page 2
    frame_rate: reader.readUint32(),
    enable_time_limit: reader.readUint32(),
    time_limit_duration: reader.readUint32(),
    // seconds
    warning_sound_start_time: reader.readUint32(),
    enable_side_scroll: reader.readUint32(),
    enable_vertical_scroll: reader.readUint32(),
    autoscroll_speed: reader.readUint32(),
    vertical_scroll_speed: reader.readUint32(),
    gravity: reader.readFloat64(),
    hit_detection_level: reader.readUint32(),
    character_shot_collision_detection_accuracy: reader.readUint32(),
    bgm_number: reader.readUint32(),
    bgm_loop_playback: reader.readUint32(),
    dont_restart_bgm_if_no_change: reader.readUint32(),
    enable_z_coordinate: reader.readUint32(),
    inherit_status_from_stock: reader.readUint32(),
    store_status_to_stock: reader.readUint32(),
    show_status_window: reader.readUint32(),
    switch_scene_immediately_on_clear: reader.readUint32(),
    allow_replay_save: reader.readUint32(),
    // show text images
    show_stage: reader.readUint32(),
    show_ready: reader.readUint32(),
    show_clear: reader.readUint32(),
    show_gameover: reader.readUint32(),
    player_collide: readPlayerCollision(reader),
    enemy_collide: readEnemyCollision(reader),
    item_collision_width: reader.readUint32(),
    item_collision_height: reader.readUint32(),
    player_hitbox: readActorHitbox(reader),
    enemy_hitbox: readActorHitbox(reader),
    // Okay this is original, but this limit the number of "ctrl-z"
    undo_max_times: reader.readUint32(),
    x_coordinate_upper_limit: reader.readUint32(),
    y_coordinate_upper_limit: reader.readUint32(),
    unk75: reader.readUint32(),
    unk76: reader.readUint32(),
    unk77: reader.readUint32(),
    unk78: reader.readUint32(),
    unk79: reader.readUint32(),
    unk80: reader.readUint32(),
    unk81: reader.readUint32(),
    unk82: reader.readUint32(),
    unk83: reader.readUint32(),
    unk84: reader.readUint32(),
    unk85: reader.readUint32(),
    unk86: reader.readUint32(),
    disable_damage_outside_screen: reader.readUint32(),
    player_invincibility_from_same_enemy_duration: reader.readUint32(),
    player_invincibility_duration: reader.readUint32(),
    enemy_invincibility_from_same_player_duration: reader.readUint32(),
    enemy_invincibility_duration: reader.readUint32(),
    stage_names: reader.readUint32(),
    // 1 -  std::vector<std::string>
    stage_name: readStdString(reader),
    ranking_size: reader.readUint32(),
    // 5  - std::vector<int>
    // Ranking
    ranking_score: reader.readUint32(),
    ranking_remaining_time: reader.readUint32(),
    ranking_clear_time: reader.readUint32(),
    ranking_remaining_hp: reader.readUint32(),
    ranking_remaining_sp: reader.readUint32(),
    // DeathFade : fade animation on death
    nonblock_enemy_death: readDeathFade(reader),
    block_enemy_death: readDeathFade(reader),
    item_death: readDeathFade(reader),
    player_death: readDeathFade(reader),
    enemy_death: readDeathFade(reader),
    // Stage Palette - add the header  FC 03 00 00 and it's a  plt4 file !
    palette: readStagePalette(reader),
    // std::vector<StageBlock>
    blocks: readArray(reader, readStageBlock),
    // std::vector<StageCharacter>
    characters: readArray(reader, readStageCharacter),
    // std::vector<Item>
    items: readArray(reader, readStageItem),
    // std::vector<Background>
    backgrounds: readArray(reader, readBackground),
    //currently fixed 1000
    stage_vars: readArray(reader, readStageVar),
    end: (() => {
      let e = reader.readUint32();
      if (e !== 123456789) {
        console.warn(`Unexpected end marker: expected 123456789, got ${file.end}`);
      }
      return e;
    })()
  };
}
class STG4Unpacker {
  constructor() {
    this.dataReader = new StreamDataReader();
    this.onChunk = null;
    this.onClose = null;
    this.headerParsed = false;
    this.chunkCount = 0;
    this.fileBuffer = new Uint8Array(0);
  }
  /**
   * Adds more binary data to unpack
   * @param {Uint8Array} uint8Array The data to add
   */
  addBinaryData(uint8Array) {
    const newBuffer = new Uint8Array(this.fileBuffer.length + uint8Array.length);
    newBuffer.set(this.fileBuffer, 0);
    newBuffer.set(uint8Array, this.fileBuffer.length);
    this.fileBuffer = newBuffer;
    if (uint8Array.length != 4096) {
      this.parseFile();
    }
  }
  /**
   * Parse the entire STG4 file when all data is available
   */
  parseFile() {
    if (this.fileBuffer.length === 0) return null;
    try {
      const reader = new DataReader(this.fileBuffer.buffer);
      return parseStagePaletteFile(reader);
    } catch (error) {
      console.error("Error parsing STG4 file:", error);
      return { error: error.message };
    }
  }
}
class STG4TransformStream {
  constructor() {
    const unpacker = new STG4Unpacker();
    let bufferedData = [];
    let totalLength = 0;
    this.stream = new TransformStream({
      transform(chunk, controller) {
        bufferedData.push(chunk);
        totalLength += chunk.length;
      },
      flush(controller) {
        const combinedBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of bufferedData) {
          combinedBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        unpacker.addBinaryData(combinedBuffer);
        const result = unpacker.parseFile();
        controller.enqueue(result);
      }
    });
    this.readable = this.stream.readable;
    this.writable = this.stream.writable;
  }
}
async function parseStage(stream) {
  const transformStream = new STG4TransformStream();
  const parsedStream = stream.pipeThrough(transformStream);
  const reader = parsedStream.getReader();
  const { value: parsedFile, done } = await reader.read();
  if (done) {
    console.log("DONE!");
    return parsedFile;
  }
  return parsedFile;
}
function serializeStage(data) {
  new WritableStream({
    write(chunk, controller) {
      console.log("Writing chunk:", chunk);
    },
    close() {
      console.log("Serialization complete");
    }
  });
  return new TransformStream({
    start(controller) {
    }
  });
}
const dropArea = document.getElementById("dropArea");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.querySelector(".browse-btn");
const output = document.getElementById("output");
const previewPlaceholder = document.getElementById("previewPlaceholder");
document.getElementById("fileInfo");
document.getElementById("chunkTableBody");
const statusMessage = document.getElementById("statusMessage");
const downloadButton = document.getElementById("download-button");
let downloadUrl = null;
let downloadName = null;
function resetPreview() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
  downloadName = null;
  downloadButton.disabled = true;
  output.style.display = "none";
  previewPlaceholder.style.display = "block";
}
function setStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = "status " + type;
  if (type === "success") {
    setTimeout(() => {
      statusMessage.style.display = "none";
    }, 3e3);
  }
}
function isStageFile(file2) {
  return /\.stg4(?:_\d+)?$/i.test(file2.name);
}
function isJsonFile(file2) {
  return file2.name.toLowerCase().endsWith(".json");
}
async function handleStageFile(file2) {
  setStatus("Processing stream...", "info");
  try {
    const stream = file2.stream();
    const parsed = await parseStage(stream);
    const json = JSON.stringify(parsed, null, 2);
    resetPreview();
    output.value = json.substring(0, 255) + "...";
    output.style.display = "block";
    previewPlaceholder.style.display = "none";
    const blob = new Blob([json], { type: "application/json" });
    downloadUrl = URL.createObjectURL(blob);
    downloadName = file2.name.replace(/\.stg4(?:_\d*)?$/i, ".json");
    downloadButton.disabled = false;
    setStatus(`Converted ${file2.name} to ${downloadName}.`, "success");
  } catch (error) {
    resetPreview();
    console.error(error);
    setStatus(`Failed to parse stream from ${file2.name}: ${error.message}`, "error");
  }
}
async function handleJsonFile(file2) {
  setStatus("Building stream...", "info");
  try {
    const text = await file2.text();
    const parsedJson = JSON.parse(text);
    const serializationStream = serializeStage(parsedJson);
    const chunks = [];
    const blobStream = new WritableStream({
      write(chunk) {
        chunks.push(chunk);
      },
      close() {
        const combinedBuffer = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          combinedBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        const blob = new Blob([combinedBuffer], { type: "application/octet-stream" });
        resetPreview();
        downloadUrl = URL.createObjectURL(blob);
        downloadName = (file2.name.replace(/\.json$/i, "") || "stage_new") + ".stg4_1020";
        downloadButton.disabled = false;
        output.style.display = "none";
        previewPlaceholder.style.display = "block";
        setStatus(`Built ${downloadName} from ${file2.name}.`, "success");
      },
      abort(err) {
        console.error("Blob stream aborted:", err);
        setStatus(`Failed to build stream from ${file2.name}: ${err.message}`, "error");
      }
    });
  } catch (error) {
    resetPreview();
    console.error(error);
    setStatus(`Failed to build from ${file2.name}: ${error.message}`, "error");
  }
}
async function handleFile(file2) {
  if (isStageFile(file2)) {
    await handleStageFile(file2);
    return;
  }
  if (isJsonFile(file2)) {
    await handleJsonFile(file2);
    return;
  }
  setStatus("Unsupported file type. Provide a .stg4_* or .json file.", "error");
}
function handleFiles(files) {
  if (!files || files.length === 0) {
    return;
  }
  setStatus("Processing...", "info");
  handleFile(files[0]);
}
browseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelect);
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, preventDefaults, false);
});
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}
["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, highlight, false);
});
["dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, unhighlight, false);
});
function highlight() {
  dropArea.classList.add("drag-over");
}
function unhighlight() {
  dropArea.classList.remove("drag-over");
}
dropArea.addEventListener("drop", handleDrop, false);
function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length) {
    handleFiles(files);
  }
}
function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length) {
    handleFiles(files[0]);
  }
}
downloadButton.addEventListener("click", () => {
  if (!downloadUrl) {
    return;
  }
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = downloadName || "stage.stg4_461";
  document.body.append(link);
  link.click();
  link.remove();
});
setStatus("Ready. Drop a file to begin.", "info");

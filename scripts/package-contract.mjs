// 与 Core 的封套版本和能力声明保持一致，校验只处理数据，不执行包内脚本。
export function packageContractProblems(envelope) {
  const problems = [];
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  if (!object(envelope) || !object(envelope.action)) return ["封套与 action 必须是对象"];
  const action = envelope.action;
  const version = envelope.notchany_export;
  if (!Number.isInteger(version) || version < 2 || version > 9) problems.push("notchany_export 必须为 2–9");
  const hints = action.dependency_hints;
  const env = action.env_requires;
  const required = action.accepts != null ? 9 : action.widget?.wants_text_input === true ? 8
    : Object.values(hints || {}).some(hint => hint?.brew) || env?.length ? 7 : action.notification != null ? 6
    : action.interpreter != null || action.requires?.length ? 4 : Object.keys(action.icons || {}).length || Object.keys(envelope.state_icon_images || {}).length ? 3 : 2;
  if (version < required) problems.push(`声明字段至少需要封套 v${required}`);
  if ("parameter_values" in action) problems.push("不得携带个人 parameter_values");
  if (!["shell", "shortcut", "open"].includes(action.kind)) problems.push("不支持此 action.kind");
  if (action.interpreter != null && !["shell", "python"].includes(action.interpreter)) problems.push("无效 interpreter");
  const commands = action.requires || [];
  if (!Array.isArray(commands) || commands.length > 8 || commands.some(name => typeof name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(name))
    || new Set(commands.map(name => String(name).toLowerCase())).size !== commands.length) problems.push("无效 requires");
  if ((commands.length || Object.keys(hints || {}).length || env?.length) && action.kind !== "shell") problems.push("环境与依赖声明仅适用于 shell");
  if (hints != null) {
    if (!object(hints)) problems.push("dependency_hints 必须是对象");
    else for (const [name, hint] of Object.entries(hints)) {
      if (!Array.isArray(commands) || !commands.includes(name) || !object(hint) || Object.keys(hint).some(key => key !== "brew")
        || (hint.brew != null && (typeof hint.brew !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+@-]{0,63}$/.test(hint.brew)))) problems.push(`无效 dependency_hints.${name}`);
    }
  }
  if (env != null) {
    if (!Array.isArray(env) || env.length > 8) problems.push("env_requires 最多 8 项");
    else {
      const seen = new Set();
      for (const item of env) {
        if (!object(item) || typeof item.key !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(item.key)
          || /^NOTCH/i.test(item.key) || seen.has(item.key.toLowerCase())
          || Object.keys(item).some(key => !["key", "description", "secret", "optional"].includes(key))
          || ["secret", "optional"].some(key => item[key] != null && typeof item[key] !== "boolean")
          || (item.description != null && (typeof item.description !== "string" || [...item.description].length > 200))) problems.push("无效 env_requires 或包含私有值");
        if (typeof item?.key === "string") seen.add(item.key.toLowerCase());
      }
    }
  }
  if (action.widget?.wants_text_input != null && typeof action.widget.wants_text_input !== "boolean") problems.push("wants_text_input 必须是布尔值");
  const accepts = action.accepts;
  if (accepts != null) {
    if (!object(accepts) || !["filesOnly", "both"].includes(action.input_kind)) problems.push("accepts 仅适用于可接收文件的动作");
    else {
      if (Object.keys(accepts).some(key => !["kinds", "types", "extensions", "count"].includes(key))) problems.push("未知 accepts 字段");
      if (accepts.count != null && !["any", "single", "multiple"].includes(accepts.count)) problems.push("无效 accepts.count");
      for (const [key, limit, predicate] of [
        ["types", 16, item => /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(item)],
        ["extensions", 32, item => /^[a-z0-9][a-z0-9+._-]{0,15}$/.test(item)],
        ["kinds", 16, item => ["image", "pdf", "video", "audio", "text", "archive", "folder", "other"].includes(item)],
      ]) if (accepts[key] != null && (!Array.isArray(accepts[key]) || accepts[key].length > limit || accepts[key].some(item => typeof item !== "string" || !predicate(item)))) problems.push(`无效 accepts.${key}`);
    }
  }
  return problems;
}

import { IMacroGenerator, MacroFactoryTable, ActionTypeTable} from '../modules/MacroGenerator/IMacroGenerator'
import { Character } from 'roll20';

const types: ActionTypeTable = {
    npcAction: "NPC Actions",
    npcLegendaryAction: "NPC Legendary Actions",
    npcTrait: "NPC Traits",
    npcReaction: "NPC Reactions",
    playerAttack: "Player Attacks",
    playerTool: "Player Tools",
    playerTrait: "Player Traits",
    spellbookCantrip: "Spellbook Cantrips",
    spellbookLvl1: "Spellbook Level 1",
    spellbookLvl2: "Spellbook Level 2",
    spellbookLvl3: "Spellbook Level 3",
    spellbookLvl4: "Spellbook Level 4",
    spellbookLvl5: "Spellbook Level 5",
    spellbookLvl6: "Spellbook Level 6",
    spellbookLvl7: "Spellbook Level 7",
    spellbookLvl8: "Spellbook Level 8",
    spellbookLvl9: "Spellbook Level 9",
};

let macroFactories: MacroFactoryTable = {};

let dataSet = {
    npcAction: {
        group: "repeating_npcaction",
        name: "name",
        macro: idx => `%{selected|repeating_npcaction_$${idx}_npc_action}`
    },

    npcLegendaryAction: {
        group: "repeating_npcaction-l",
        name: "name",
        macro: idx => `%{selected|repeating_npcaction-l_$${idx}_npc_action}`
    },

    npcTrait: {
        group: "repeating_npctrait",
        name: "name",
        macro: idx => `@{selected|wtype}&{template:npcaction} {{name=@{selected|npc_name}}} {{rname=@{selected|repeating_npctrait_$${idx}_name}}} {{description=@{selected|repeating_npctrait_$${idx}_desc}}}`
    },

    npcReaction: {
        group: "repeating_npcreaction",
        name: "name",
        macro: idx => `@{selected|wtype}&{template:npcaction} {{name=@{selected|npc_name}}} {{rname=@{selected|repeating_npcreaction_$${idx}_name}}} {{description=@{selected|repeating_npcreaction_$${idx}_desc}}}`,
        nameMod: name => "Reaction:" + name,
    },

    playerAttack: {
        group: "repeating_attack",
        name: "atkname",
        macro: idx => `%{selected|repeating_attack_$${idx}_attack}`,
    },

    playerTool: {
        group: "repeating_tool",
        name: "toolname",
        macro: idx => `%{selected|repeating_tool_$${idx}_tool}`
    },

    playerTrait: {
        group: "repeating_traits",
        name: "name",
        macro: idx => `@{selected|wtype}&{template:traits} @{selected|charname_output} {{name=@{selected|repeating_traits_$${idx}_name}}} {{source=@{selected|repeating_traits_$${idx}_source}: @{selected|repeating_traits_$${idx}_source_type}}} {{description=@{selected|repeating_traits_$${idx}_description}}}`
    },

    spellbookCantrip: {
        group: "repeating_spell-cantrip",
        name: "spellname",
        macro: idx => `%{selected|repeating_spell-cantrip_$${idx}_spell}`
    }
};

for (let lvl = 1; lvl <= 9; lvl++) {
    dataSet[`spellbookLvl${lvl}`] = {
        group: `repeating_spell-${lvl}`,
        name: "spellname",
        macro: idx => `%{selected|repeating_spell-${lvl}_$${idx}_spell}`
    }
}

const generateMacroData = (char: Character,
                           group: string,
                           nameAttrib: string,
                           macroFactory: (idx: number) => string,
                           nameMod?: (name: string) => string) => {
    let table = {};

    // create a sorted table so that we can create abilities that reference actions by index.
    char.attribs.models.forEach(a => {
        const name = a.get<string>("name");
        if (!name.startsWith(group + "_")) return;

        const words = name.split('_');
        if (words.length < 2) return;

        const id = words[2];
        table[id] = true;
    });

    const ids = char.repeatingKeyOrder(Object.keys(table), group);

    // we've got the ordered table, now make the macros.
    const orderedNames = [];
    for (let idIdx = 0; idIdx < ids.length; idIdx++) {
        const id = ids[idIdx];
        const query = `${group}_${id}_${nameAttrib}`;
        const name = char.attribs.models.find(a => a.get("name") === query);

        if (!name) {
            console.error("[Bulk macro generator for 5e OGL R20] Could not find name for repeating section.");
            console.table({
                "Query": query,
                "Group name": group,
                "Name Attribute Name": nameAttrib,
                "Character name": char.get("name"),
                "Character UUID": char.get("id")
            });;

            continue;
        }

        let finalName = name.get<string>("current");
        if(typeof(nameMod) === "function") {
            finalName = nameMod(finalName);
        }

        orderedNames.push({
            name: finalName,
            macro: macroFactory(idIdx)
        });
    }

    return orderedNames;
};

for (let actionType in types) {
    const data = dataSet[actionType];
    macroFactories[actionType] = char => generateMacroData(char, data.group, data.name, data.macro, data.nameMod);
}

const OGL5eByRoll20: IMacroGenerator = {
    actionTypes: types,
    macroFactories: macroFactories,
    id: "D&D 5e OGL by Roll20",
    name: "D&D 5e OGL by Roll20",
};

export default OGL5eByRoll20;

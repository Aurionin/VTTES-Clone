import { R20Module } from "../../tools/R20Module";
import { R20 } from "../../tools/R20";
import { LoadingDialog } from "../../tools/DialogComponents";
import { DOM } from "../../tools/DOM";
import { SheetTab } from "../../tools/SheetTab";
import { replaceAll } from "../../tools/MiscUtils";
import { IMacroGenerator, IGeneratedMacro, IMacroDiff } from "./IMacroGenerator";
import OGL5eByRoll20 from "../../macro/OGL5eByRoll20";
import PickMacroGeneratorsDialog from "./PickMacroGeneratorsDialog";
import { Character, CharacterAbility } from "roll20";
import DuplicateResolveDialog from "./DuplicateResolveDialog";
import VerifyMacrosDialog from "./VerifyMacrosDialog";
import NoMacrosDialog from "./NoMacrosDialog";

class MacroGeneratorModule extends R20Module.SimpleBase {
    private pickerDialog: PickMacroGeneratorsDialog;
    private verifyDialog: VerifyMacrosDialog;
    private dupeDialog: DuplicateResolveDialog<IGeneratedMacro>;
    private noMacrosDialog: NoMacrosDialog;
    private sheetTab: any;

    public generators: { [id: string]: IMacroGenerator } = {};

    private activePc: Character;
    public activeGenerator: IMacroGenerator;
    public setIsTokenAction: boolean = true;
    public categoryFilter: { [id: string]: boolean } = {};
    public byNameMacroTable: { [name: string]: IGeneratedMacro[] } = {};

    private macroBuffer: IGeneratedMacro[] = [];
    private modifiedMacros: IMacroDiff[] = [];
    private addedMacros: IGeneratedMacro[] = [];

    constructor() {
        super(__dirname);

        const addGen = gen => this.generators[gen.id] = gen;
        addGen(OGL5eByRoll20);
    }

    private showVerify() {

        const pc = this.activePc;

        const abilitiesByName = pc.abilities.models.reduce((accum, val) => {
            const name = val.get<string>("name");
            accum[name] = val;
            return accum;
        }, {} as { [id: string]: CharacterAbility });

        this.macroBuffer.forEach(macro => {
            if (macro.name in abilitiesByName) {
                const oldMacro = abilitiesByName[macro.name].get<string>("action");

                if(oldMacro === macro.macro) return;

                this.modifiedMacros.push({
                    name: macro.name,
                    macro: macro.macro,
                    oldMacro,
                });
            } else {
                this.addedMacros.push(macro);
            }
        });

        if (this.modifiedMacros.length <= 0 && this.addedMacros.length <= 0) {
            this.noMacrosDialog.show();
        } else {
            this.verifyDialog.show(this.modifiedMacros, this.addedMacros);
        }
    }

    private onPickerDialogClose = (e: any) => {

        e.stopPropagation();

        if(!this.pickerDialog.isSuccessful()) return;
        if (!this.activePc) return;

        // generate an array of macros in wanted categories
        let data: IGeneratedMacro[] = [];
        for (let factoryId in this.activeGenerator.macroFactories) {
            if (!this.categoryFilter[factoryId]) continue;

            const factory = this.activeGenerator.macroFactories[factoryId];
            data = data.concat(factory(this.activePc));
        }

        // r20 forbids spaces in abilities
        for (let obj of data) {
            obj.name = replaceAll(obj.name, " ", "-");
        }

        // sort lexicographically
        data.sort((a, b) => {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
        });

        // make a by-name table
        for (const obj of data) {
            if (!(obj.name in this.byNameMacroTable)) this.byNameMacroTable[obj.name] = [];
            this.byNameMacroTable[obj.name].push(obj);
        }

        let hasDupes = false;
        for (const key in this.byNameMacroTable) {
            if (this.byNameMacroTable[key].length > 1) {
                hasDupes = true;
                break;
            }
        }

        const descRetriever = (data: IGeneratedMacro) => data.macro;

        if (hasDupes) {
            this.dupeDialog.show(this.byNameMacroTable, descRetriever);
        } else {
            this.macroBuffer = data;
            this.showVerify();
        }
    }

    private onVerifyDialogClose = (e: any) => {
        e.stopPropagation();

        if(!this.verifyDialog.isSuccessful()) return;

        this.generateMacros();
    }

    private onButtonClick = (e: any) => {
        e.stopPropagation();

        const attrib = "data-characterid";
        const elem = $(e.target).closest(`[${attrib}]`)[0];
        if (!elem) {
            console.error("Failed to find character id for macro generation");
            return;
        }

        const id = elem.getAttribute(attrib);
        const pc = R20.getCharacter(id);
        if (!pc) {
            console.error(`Failed to get character for macro generation: getCharacter("${id}") failed.`);
            return;
        }

        this.activePc = pc;
        this.activeGenerator = null;
        this.setIsTokenAction = true;
        this.categoryFilter = {};
        this.byNameMacroTable = {};
        this.macroBuffer = [];
        this.modifiedMacros = [];
        this.addedMacros = [];

        this.pickerDialog.show();
    }

    private renderSheet = () => {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button style={{ width: "50%", height: "30px", display: "flex", justifyContent: "center" }} className="btn" onClick={this.onButtonClick}>
                    Open Generate Macros Dialog
            </button>
            </div>
        );
    }

    private onDupeDialogClose = (e: any) => {
        e.stopPropagation();

        if(!this.dupeDialog.isSuccessful()) return;

        const selectedButtonsTable = this.dupeDialog.getData();

        for (const key in this.byNameMacroTable) {
            const curMacros = this.byNameMacroTable[key];
            const selectedIndex = selectedButtonsTable[key];

            this.macroBuffer.push(curMacros[selectedIndex]);
        }

        this.showVerify();
    }

    private generateMacros() {
        const pc = this.activePc;
        if (!pc) return;

        let plsWait = new LoadingDialog("Generating");
        plsWait.show();

        // wait for plsWait to render.
        setTimeout(() => {
            try {
                for (let macro of this.modifiedMacros) {

                    const existing = pc.abilities.find(f => f.get("name") === macro.name);

                    if (!existing) {
                        console.error("Tried to modify existing ability but could not find it.");
                        console.table({
                            "Query": macro.name,
                            "Macro": macro.macro,
                            "Char Name": pc.get("name"),
                            "Char UUID": pc.get("id")
                        });

                        this.addedMacros.push(macro);
                        continue;
                    }

                    existing.save({
                        action: macro.macro,
                        istokenaction: this.setIsTokenAction,
                    });
                }

                for (let macro of this.addedMacros) {
                    pc.abilities.create({
                        name: macro.name,
                        action: macro.macro,
                        istokenaction: this.setIsTokenAction,
                    });
                }

                pc.view.render();
            } catch (err) {
                console.error(err);
            }

            plsWait.dispose();
        }, 100);
    }

    public setup() {
        this.pickerDialog = new PickMacroGeneratorsDialog(this);
        this.pickerDialog.getRoot().addEventListener("close", this.onPickerDialogClose);

        this.verifyDialog = new VerifyMacrosDialog();
        this.verifyDialog.getRoot().addEventListener("close", this.onVerifyDialogClose);

        this.dupeDialog = new DuplicateResolveDialog();
        this.dupeDialog.getRoot().addEventListener("close", this.onDupeDialogClose);

        this.noMacrosDialog = new NoMacrosDialog();

        this.sheetTab = SheetTab.add("Macro Generator", this.renderSheet);
    }

    public dispose() {
        if (this.sheetTab) this.sheetTab.dispose();

        if (this.pickerDialog) this.pickerDialog.dispose();
        if (this.verifyDialog) this.verifyDialog.dispose();
        if (this.dupeDialog) this.dupeDialog.dispose();
        if (this.noMacrosDialog) this.noMacrosDialog.dispose();

    }
}

if (R20Module.canInstall()) new MacroGeneratorModule().install()

export default MacroGeneratorModule;

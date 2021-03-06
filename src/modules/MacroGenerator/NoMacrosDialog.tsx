import { DialogBase } from "../../tools/DialogBase";
import { DOM } from "../../tools/DOM";
import { Dialog, DialogHeader, DialogFooter, DialogFooterContent, DialogBody, CheckboxWithText } from "../../tools/DialogComponents";

export default class NoMacrosDialog extends DialogBase<null> {
    public show = this.internalShow;
    protected render(): HTMLElement {
        return (
            <Dialog>
                <DialogHeader>
                    <h2>Notice</h2>
                </DialogHeader>

                <hr />

                <DialogBody>
                    <p>We found nothing to make a macro for.</p>
                </DialogBody>

                <DialogFooter>
                    <DialogFooterContent>
                        <button style={{ boxSizing: "border-box", width: "100%" }} className="btn" onClick={this.close}>OK</button>
                    </DialogFooterContent>
                </DialogFooter>

            </Dialog> as any
        )
    }
}

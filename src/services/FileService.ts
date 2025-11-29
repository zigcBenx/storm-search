import * as vscode from 'vscode';


export class FileService {
    async getFileContent(filePath: string): Promise<string> {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        return document.getText();
    }

    async openFileAtLocation(filePath: string, line: number, column: number): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        const position = new vscode.Position(line - 1, column);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );
    }
}

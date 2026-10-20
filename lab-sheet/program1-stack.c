#include <stdio.h>

#define SIZE 5

int rowStack[SIZE];
int colStack[SIZE];
int top = -1;

// throws away the rest of a line the user typed wrongly (for example a letter)
void clearInput() {
    int ch = getchar();
    while (ch != '\n' && ch != EOF)
        ch = getchar();
}

void push() {
    int r, c;

    if (top == SIZE - 1) {
        printf("STACK OVERFLOW\n");
        return;
    }
    printf("Enter row and column: ");
    if (scanf("%d %d", &r, &c) != 2) {
        clearInput();
        printf("Invalid position. Type two numbers, for example 2 3\n");
        return;
    }

    top++;
    rowStack[top] = r;
    colStack[top] = c;
    printf("Pushed (%d, %d)\n", r, c);
}

void pop() {
    if (top == -1) {
        printf("STACK UNDERFLOW. No position to pop\n");
        return;
    }
    printf("Popped (%d, %d)\n", rowStack[top], colStack[top]);
    top--;
}

void peek() {
    if (top == -1) {
        printf("Stack is empty\n");
        return;
    }
    printf("Top position is (%d, %d)\n", rowStack[top], colStack[top]);
}

void display() {
    int i;

    if (top == -1) {
        printf("Stack is empty (top = -1)\n");
        return;
    }
    printf("Positions in the stack (top = %d):\n", top);
    for (i = top; i >= 0; i--) {
        printf("(%d, %d)\n", rowStack[i], colStack[i]);
    }
}

int main() {
    int choice;

    do {
        printf("\n--- Stack of Wheelchair Positions ---\n");
        printf("1. Push\n");
        printf("2. Pop\n");
        printf("3. Peek\n");
        printf("4. Display\n");
        printf("5. Exit\n");

        printf("Choice: ");
        if (scanf("%d", &choice) != 1) {
            if (feof(stdin))
                break;          // no more input at all, so stop
            clearInput();
            choice = 0;         // goes to "Invalid choice"
        }

        switch (choice) {
            case 1:
                push();
                break;
            case 2:
                pop();
                break;
            case 3:
                peek();
                break;
            case 4:
                display();
                break;
            case 5:
                printf("Program terminated\n");
                break;
            default:
                printf("Invalid choice\n");
        }
    } while (choice != 5);

    return 0;
}

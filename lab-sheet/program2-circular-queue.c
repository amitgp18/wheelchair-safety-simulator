#include <stdio.h>

#define MAX 5

char queue[MAX];
int front = -1;
int rear = -1;

// throws away the rest of a line the user typed wrongly (for example a letter)
void clearInput() {
    int ch = getchar();
    while (ch != '\n' && ch != EOF)
        ch = getchar();
}

void enqueue() {
    char value;

    if ((rear + 1) % MAX == front) {
        printf("Queue is Full\n");
        return;
    }
    printf("Enter move (N, E, S or W): ");
    scanf(" %c", &value);

    if (value != 'N' && value != 'E' && value != 'S' && value != 'W') {
        printf("Invalid move\n");
        return;
    }

    if (front == -1) {
        front = 0;
        rear = 0;
    } else {
        rear = (rear + 1) % MAX;
    }
    queue[rear] = value;
    printf("%c inserted successfully\n", value);
}

void dequeue() {
    if (front == -1) {
        printf("Queue is Empty\n");
        return;
    }

    printf("%c deleted successfully\n", queue[front]);

    if (front == rear) {
        front = -1;
        rear = -1;
    } else {
        front = (front + 1) % MAX;
    }
}

void peek() {
    if (front == -1) {
        printf("Queue is Empty\n");
        return;
    }
    printf("Front move is %c\n", queue[front]);
}

void display() {
    int i;

    if (front == -1) {
        printf("Queue is Empty (front = -1, rear = -1)\n");
        return;
    }

    printf("Queue elements: ");
    i = front;
    while (1) {
        printf("%c ", queue[i]);

        if (i == rear)
            break;

        i = (i + 1) % MAX;
    }
    printf("\n");
    printf("front = %d, rear = %d\n", front, rear);
}

int main() {
    int choice;

    while (1)
    {
        printf("\n--- Circular Queue of Move Requests ---\n");
        printf("1. Enqueue\n");
        printf("2. Dequeue\n");
        printf("3. Peek\n");
        printf("4. Display\n");
        printf("5. Exit\n");

        printf("Enter your choice: ");
        if (scanf("%d", &choice) != 1) {
            if (feof(stdin))
                return 0;       // no more input at all, so stop
            clearInput();
            choice = 0;         // goes to "Invalid choice"
        }

        switch (choice)
        {
            case 1:
                enqueue();
                break;

            case 2:
                dequeue();
                break;

            case 3:
                peek();
                break;

            case 4:
                display();
                break;

            case 5:
                printf("Program terminated\n");
                return 0;

            default:
                printf("Invalid choice\n");
        }
    }

    return 0;
}

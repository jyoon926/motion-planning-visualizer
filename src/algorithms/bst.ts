export class BinarySearchTreeNode<T> {
  data: T;
  leftNode?: BinarySearchTreeNode<T>;
  rightNode?: BinarySearchTreeNode<T>;

  constructor(data: T) {
    this.data = data;
  }
}

export class BinarySearchTree<T> {
  root?: BinarySearchTreeNode<T>;
  comparator: (a: T, b: T) => number;

  constructor(comparator: (a: T, b: T) => number) {
    this.comparator = comparator;
  }

  insert(data: T): BinarySearchTreeNode<T> | undefined {
    if (!this.root) {
      this.root = new BinarySearchTreeNode(data);
      return this.root;
    }

    let current = this.root;

    while (true) {
      if (this.comparator(data, current.data) === 1) {
        if (current.rightNode) {
          current = current.rightNode;
        } else {
          current.rightNode = new BinarySearchTreeNode(data);
          return current.rightNode;
        }
      } else {
        if (current.leftNode) {
          current = current.leftNode;
        } else {
          current.leftNode = new BinarySearchTreeNode(data);
          return current.leftNode;
        }
      }
    }
  }

  search(data: T): BinarySearchTreeNode<T> | undefined {
    if (!this.root) return undefined;

    let current = this.root;

    while (this.comparator(data, current.data) !== 0) {
      if (this.comparator(data, current.data) === 1) {
        if (!current.rightNode) return;

        current = current.rightNode;
      } else {
        if (!current.leftNode) return;

        current = current.leftNode;
      }
    }

    return current;
  }

  inOrderTraversal(node: BinarySearchTreeNode<T> | undefined): void {
    if (node) {
      this.inOrderTraversal(node.leftNode);
      console.log(node.data);
      this.inOrderTraversal(node.rightNode);
    }
  }

  preOrderTraversal(node: BinarySearchTreeNode<T> | undefined): void {
    if (node) {
      console.log(node.data);
      this.preOrderTraversal(node.leftNode);
      this.preOrderTraversal(node.rightNode);
    }
  }

  postOrderTraversal(node: BinarySearchTreeNode<T> | undefined): void {
    if (node) {
      this.postOrderTraversal(node.leftNode);
      this.postOrderTraversal(node.rightNode);
      console.log(node.data);
    }
  }

  leftmost(node: BinarySearchTreeNode<T> | undefined): BinarySearchTreeNode<T> | undefined {
    if (node) {
      if (node.leftNode) {
        return this.leftmost(node.leftNode);
      } else {
        return node;
      }
    } else {
      return undefined;
    }
  }

  delete(root: BinarySearchTreeNode<T> | undefined, data: T): BinarySearchTreeNode<T> | undefined {
    if (root === undefined) return undefined;

    const cmp = this.comparator(data, root.data);

    if (cmp < 0) {
      // value is in the left subtree
      root.leftNode = this.delete(root.leftNode, data);
      return root;
    } else if (cmp > 0) {
      // value is in the right subtree
      root.rightNode = this.delete(root.rightNode, data);
      return root;
    } else {
      // found the node to delete
      if (!root.leftNode && !root.rightNode) {
        return undefined;
      }

      if (!root.leftNode) {
        return root.rightNode;
      }

      if (!root.rightNode) {
        return root.leftNode;
      }

      let successor = root.rightNode;
      while (successor.leftNode !== undefined) {
        successor = successor.leftNode;
      }

      root.data = successor.data;
      root.rightNode = this.delete(root.rightNode, successor.data);

      return root;
    }
  }
}

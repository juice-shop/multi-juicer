resource "aws_iam_user" "state_user" {
  name = "state-reader"
}

resource "aws_iam_access_key" "state_user_key" {
  user = aws_iam_user.state_user.id
}

resource "aws_iam_user_policy" "state_user_policy" {
  user   = aws_iam_user.state_user.id
  policy = data.aws_iam_policy_document.state_user_policy.json
}

#tfsec:ignore:aws-iam-no-policy-wildcards
data "aws_iam_policy_document" "state_user_policy" {
  statement {
    sid    = "AllowS3ListAccess"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation"
    ]
    resources = [
      var.state_bucket_arn
    ]
  }

  statement {
    sid    = "AllowS3GetObject"
    effect = "Allow"
    actions = [
      "s3:GetObject*",
    ]
    resources = [
      "${var.state_bucket_arn}/*"
    ]
  }

  statement {
    sid    = "AllowAssumeRole"
    effect = "Allow"
    actions = [
      "sts:AssumeRole"
    ]
    resources = [aws_iam_role.user_role.arn]
  }
}

resource "aws_secretsmanager_secret" "state_user_access_keys" {
  name                    = "s3-state-user"
  description             = "The access keys for S3 access"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "state_user_access_keys" {
  secret_id     = aws_secretsmanager_secret.state_user_access_keys.id
  secret_string = <<JSON
{
    "aws_user_name": "${aws_iam_user.state_user.name}",
    "aws_access_key_id": "${aws_iam_access_key.state_user_key.id}",
    "aws_secret_access_key": "${aws_iam_access_key.state_user_key.secret}"
}
JSON
}

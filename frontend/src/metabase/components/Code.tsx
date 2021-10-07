/* eslint "react/prop-types": "warn" */
import React from "react";
import PropTypes from "prop-types";

type Props = PropTypes.InferProps<typeof propTypes>;

const Code: React.FC<Props> = ({ children, block }) => {
  if (block) {
    return <div className="text-code">{children}</div>;
  } else if (typeof children === "string" && children.split(/\n/g).length > 1) {
    return (
      <span>
        {children.split(/\n/g).map((line, index) => (
          <React.Fragment key={index}>
            <span className="text-code" style={{ lineHeight: "1.8em" }}>
              {line}
            </span>
            <br />
          </React.Fragment>
        ))}
      </span>
    );
  } else {
    return <span className="text-code">{children}</span>;
  }
};

const propTypes = {
  children: PropTypes.any.isRequired,
  block: PropTypes.bool,
};

Code.propTypes = propTypes;

export default Code;
